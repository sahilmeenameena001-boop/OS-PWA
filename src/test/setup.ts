import "fake-indexeddb/auto";
import { beforeEach } from "vitest";
import { LifeDB, setDB } from "@/lib/data/db";

let counter = 0;
beforeEach(() => {
  // Fresh isolated IndexedDB per test.
  setDB(new LifeDB(`test-${Date.now()}-${counter++}`));
});
