export class KeyRotator {
  constructor(keys = []) {
    this.keys = keys;
    this.currentIndex = 0;
    this.retries = 0;
  }

  getHeaders() {
    return this.keys[this.currentIndex];
  }

  rotate(provider) {
    if (this.keys.length > 0) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }
  }

  async executeWithRotation(provider, apiCallFn) {
    try {
      const result = await apiCallFn(this.getHeaders());
      this.retries = 0;
      return result;
    } catch (error) {
      if (error.status === 429 || error.status === 403) {
        console.warn(`[ROTATOR] Key ${this.currentIndex} for ${provider} exhausted. Swapping...`);
        this.rotate(provider);
        if (this.retries < 3) {
          this.retries++;
          return this.executeWithRotation(provider, apiCallFn);
        }
      }
      this.retries = 0;
      throw error;
    }
  }
}

export default KeyRotator;
