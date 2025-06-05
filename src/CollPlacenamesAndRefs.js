import collPlacenamesAndRefs from './data/smr-placenames-and-refs.json';

class CollPlacenamesAndRefs {
    constructor() {
        this.data = collPlacenamesAndRefs;
    }
    
    getGloss(termId) {
        const entry = this.data[termId];
        if (!entry) {
            console.warn(`TermId "${termId}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.gloss;   
    }

    getDefinition(termId) {
        const entry = this.data[termId];
        if (!entry) {
  //          console.warn(`TermId "${termId}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.context;   
    }

    getTransliteration(termId) {
        const entry = this.data[termId];
        if (!entry) {
//            console.warn(`TermId "${termId}" not found in collPlacenamesAndRefs`);
            return '';
        }
        return entry.transliteration;   
    }

    getRefs(termId) {
        const entry = this.data[termId];
        if (!entry) {
            console.warn(`TermId "${termId}" not found in collPlacenamesAndRefs`);
            return [];
        }
        return entry.refs || [];   
    }
}

const collPlacenames = new CollPlacenamesAndRefs();
export { collPlacenames };
export default CollPlacenamesAndRefs;