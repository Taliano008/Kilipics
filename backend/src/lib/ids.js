import { ulid } from "ulid";

// 26 chars, matches every CHAR(26) primary key, lexicographically sortable
// by creation time. One import site so it's one place to change.
export function newId() {
  return ulid();
}
