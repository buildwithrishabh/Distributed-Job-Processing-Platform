/**
 * Fixed-capacity ring buffer used to build the dashboard's time series.
 * Cheap to append, cheap to snapshot, never grows without bound.
 */

export class RingBuffer {
  /** @param {number} capacity */
  constructor(capacity = 60) {
    this.capacity = capacity;
    /** @type {Array<Record<string, number>>} */
    this.items = [];
  }

  /** @param {Record<string, number>} point */
  push(point) {
    this.items.push(point);
    if (this.items.length > this.capacity) {
      this.items.splice(0, this.items.length - this.capacity);
    }
    return this;
  }

  /** @param {string} key */
  series(key) {
    return this.items.map((item) => Number(item[key] ?? 0));
  }

  get length() {
    return this.items.length;
  }

  get isEmpty() {
    return this.items.length === 0;
  }

  last(key) {
    const item = this.items[this.items.length - 1];
    return item ? Number(item[key] ?? 0) : 0;
  }

  clear() {
    this.items = [];
  }
}
