import { useEffect, useState } from "react";
import { createItem, deleteItem, getItem, getItemsList, updateItem } from "./api/fakeApi.js";

const EMPTY_FORM = { name: "", description: "", category: "", owner: "", location: "", price: "" };

export default function App() {
  // list
  const [items, setItems] = useState([]);
  const [listStatus, setListStatus] = useState("loading"); // loading | error | success
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // details
  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsStatus, setDetailsStatus] = useState("idle"); // idle | loading | error | success
  const [detailsError, setDetailsError] = useState("");

  // actions (create / edit / delete / change status) — only one at a time
  const [busy, setBusy] = useState(null); // e.g. "Updating item #3"
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState(null); // null | { editId: number|null, values }

  // Load list on mount and every time Reload is pressed (reloadKey changes)
  useEffect(() => {
    let ignore = false;
    setListStatus("loading");

    getItemsList()
      .then((data) => {
        if (ignore) return;
        setItems(data);
        setListStatus("success");
      })
      .catch((error) => {
        if (ignore) return;
        setListError(error.message);
        setListStatus("error");
      });

    // cleanup: ignore the response of an outdated request
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // Load details whenever the selected item changes
  useEffect(() => {
    if (selectedId === null) {
      setDetails(null);
      setDetailsStatus("idle");
      return;
    }

    let ignore = false;
    setDetails(null);
    setDetailsStatus("loading");

    getItem(selectedId)
      .then((data) => {
        if (ignore) return;
        setDetails(data);
        setDetailsStatus("success");
      })
      .catch((error) => {
        if (ignore) return;
        setDetailsError(error.message);
        setDetailsStatus("error");
      });

    // cleanup: when user switches item quickly, the old response is ignored
    // so outdated details are never shown (race condition prevention)
    return () => {
      ignore = true;
    };
  }, [selectedId]);

  async function runAction(label, action) {
    setBusy(label);
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(`${label} failed: ${error.message}`);
    } finally {
      setBusy(null);
    }
  }

  function toggleStatus() {
    // capture id and status NOW — selection may change while the request is in flight
    const id = details.id;
    const nextStatus = details.status === "available" ? "in use" : "available";

    runAction(`Updating item #${id}`, async () => {
      const updated = await updateItem(id, { status: nextStatus });
      // functional updates use the latest state, not a stale closure
      setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, status: updated.status } : i)));
      setDetails((prev) => (prev && prev.id === updated.id ? updated : prev));
    });
  }

  function removeItem(id) {
    if (!confirm(`Delete item #${id}?`)) return;
    runAction(`Deleting item #${id}`, async () => {
      await deleteItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
    });
  }

  function saveForm(event) {
    event.preventDefault();
    const { editId, values } = form;
    const data = { ...values, price: Number(values.price) || 0 };

    runAction(editId ? `Saving item #${editId}` : "Creating item", async () => {
      if (editId) {
        const updated = await updateItem(editId, data);
        setDetails((prev) => (prev && prev.id === updated.id ? updated : prev));
      } else {
        const created = await createItem(data);
        setSelectedId(created.id);
      }
      setForm(null);
      setReloadKey((k) => k + 1);
    });
  }

  function changeField(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, values: { ...prev.values, [name]: value } }));
  }

  return (
    <div className="app">
      <header>
        <h1>Inventory</h1>
        <div className="row">
          <button onClick={() => setReloadKey((k) => k + 1)} disabled={listStatus === "loading"}>
            Reload
          </button>
          <button onClick={() => setForm({ editId: null, values: EMPTY_FORM })} disabled={busy !== null}>
            + New item
          </button>
        </div>
      </header>

      {busy && <p className="info">{busy}…</p>}
      {actionError && <p className="error">{actionError}</p>}

      {form && (
        <form className="card form" onSubmit={saveForm}>
          <h2>{form.editId ? `Edit item #${form.editId}` : "New item"}</h2>
          {Object.keys(EMPTY_FORM).map((field) => (
            <label key={field}>
              {field}
              <input
                name={field}
                type={field === "price" ? "number" : "text"}
                value={form.values[field]}
                onChange={changeField}
                required={field === "name"}
              />
            </label>
          ))}
          <div className="row">
            <button type="submit" disabled={busy !== null}>Save</button>
            <button type="button" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <main>
        <section className="card">
          <h2>Items</h2>
          {listStatus === "loading" && <p className="info">Loading items…</p>}
          {listStatus === "error" && (
            <p className="error">
              {listError} <button onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
            </p>
          )}
          {listStatus === "success" && items.length === 0 && <p>No items yet. Create one!</p>}
          {listStatus === "success" && (
            <ul className="list">
              {items.map((item) => (
                <li key={item.id} className={item.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(item.id)}>
                  <span>{item.name}</span>
                  <span className={`badge ${item.status === "available" ? "ok" : ""}`}>{item.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Details</h2>
          {detailsStatus === "idle" && <p>Select an item to see details.</p>}
          {detailsStatus === "loading" && <p className="info">Loading details of item #{selectedId}…</p>}
          {detailsStatus === "error" && <p className="error">{detailsError}</p>}
          {detailsStatus === "success" && details && (
            <>
              <dl>
                <dt>ID</dt><dd>{details.id}</dd>
                <dt>Name</dt><dd>{details.name}</dd>
                <dt>Description</dt><dd>{details.description || "—"}</dd>
                <dt>Category</dt><dd>{details.category || "—"}</dd>
                <dt>Owner</dt><dd>{details.owner || "—"}</dd>
                <dt>Location</dt><dd>{details.location || "—"}</dd>
                <dt>Price</dt><dd>${details.price}</dd>
                <dt>Status</dt><dd>{details.status}</dd>
              </dl>
              <div className="row">
                <button onClick={toggleStatus} disabled={busy !== null}>
                  {details.status === "available" ? "Mark in use" : "Mark available"}
                </button>
                <button
                  onClick={() => setForm({ editId: details.id, values: { ...EMPTY_FORM, ...details } })}
                  disabled={busy !== null}
                >
                  Edit
                </button>
                <button className="danger" onClick={() => removeItem(details.id)} disabled={busy !== null}>
                  Delete
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
