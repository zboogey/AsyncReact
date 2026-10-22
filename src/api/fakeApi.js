// Based on https://github.com/leravanna/fake-api
// Simulates a server with Promises, random delays, random errors and localStorage.
import { API_CONFIG, DATA_KEY } from "./settings.js";
import { initialData } from "./initialData.js";

function fakeRequest(operation) {
  const { minDelay, maxDelay, errorChance } = API_CONFIG;
  return new Promise((resolve, reject) => {
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    setTimeout(() => {
      if (Math.random() < errorChance) {
        reject(new Error("Simulated server error"));
        return;
      }
      try {
        resolve(operation());
      } catch (error) {
        reject(error);
      }
    }, delay);
  });
}

function readData() {
  return JSON.parse(localStorage.getItem(DATA_KEY) || "[]");
}

function writeData(items) {
  localStorage.setItem(DATA_KEY, JSON.stringify(items));
}

if (!localStorage.getItem(DATA_KEY)) {
  writeData(initialData);
}

// GET /items — returns only short info, details are loaded with getItem
export function getItemsList() {
  return fakeRequest(() =>
    readData()
      .map(({ id, name, status }) => ({ id, name, status }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

// GET /items/:id
export function getItem(id) {
  return fakeRequest(() => {
    const item = readData().find((item) => item.id === id);
    if (!item) throw new Error("Item not found");
    return item;
  });
}

// POST /items
export function createItem(data) {
  return fakeRequest(() => {
    const items = readData();
    const nextId = items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    const newItem = { ...data, id: nextId, status: "available" };
    writeData([...items, newItem]);
    return newItem;
  });
}

// PATCH /items/:id
export function updateItem(id, changes) {
  return fakeRequest(() => {
    const items = readData();
    if (!items.some((item) => item.id === id)) throw new Error("Item not found");
    const updated = items.map((item) => (item.id === id ? { ...item, ...changes, id } : item));
    writeData(updated);
    return updated.find((item) => item.id === id);
  });
}

// DELETE /items/:id
export function deleteItem(id) {
  return fakeRequest(() => {
    const items = readData();
    if (!items.some((item) => item.id === id)) throw new Error("Item not found");
    writeData(items.filter((item) => item.id !== id));
    return { success: true, id };
  });
}
