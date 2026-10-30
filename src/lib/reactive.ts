import type { Derived } from "ripple";

/**
 * Read a primitive prop that may be live.
 *
 * A prop expression is evaluated once, when a component is called, so a plain
 * `string` never updates after the call. A `Derived` does: reading `.value`
 * inside the component's render subscribes it. Primitive props that a page will
 * change (a field's value, a toggle's state, a tab) are typed `Derived<T> | T`
 * and read through this helper, so either shape works at the call site.
 */
export function read<V>(value: Derived<V> | V): V {
  if (value !== null && typeof value === "object" && "value" in (value as object)) {
    return (value as unknown as Derived<V>).value;
  }
  return value as V;
}
