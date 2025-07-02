class TermRenderings {
  constructor() {
    this.data = {};
  }

  setData(data) {
    this.data = data;
  }

  getEntry(termId) {
    return this.data[termId];
  }
}

export default TermRenderings;
