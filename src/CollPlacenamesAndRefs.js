import collPlacenamesAndRefs from './data/SMR_PlaceNames&Refs.json';

class CollPlacenamesAndRefs {
    constructor() {
        this.data = collPlacenamesAndRefs;
    }
    
    getGloss(mergeKey) {
        const entry = this.data[mergeKey];
        if (!entry) {
            console.warn(`mergeKey "${mergeKey}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.gloss;   
    }

    getTermId(mergeKey) {
        const entry = this.data[mergeKey];
        if (!entry) {
            console.warn(`mergeKey "${mergeKey}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.termId;   
    }

    getDefinition(mergeKey) {
        const entry = this.data[mergeKey];
        if (!entry) {
  //          console.warn(`mergeKey "${mergeKey}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.context;   
    }

    getTransliteration(mergeKey) {
        const entry = this.data[mergeKey];
        if (!entry) {
//            console.warn(`mergeKey "${mergeKey}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.transliteration;   
    }

    getRefs(mergeKey) {
        const entry = this.data[mergeKey];
        if (!entry) {
            console.warn(`mergeKey "${mergeKey}" not found in collPlacenamesAndRefs`);
            return [];
        }
        return entry.refs || [];   
    }
}

const collPlacenames = new CollPlacenamesAndRefs();
export { collPlacenames };
export default CollPlacenamesAndRefs;