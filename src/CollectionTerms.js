import mapBibTermsData from './data/smr-term-list.json';

class CollectionTerms {
    constructor() {
        this.data = mapBibTermsData;
    }
    
    getGloss(termId) {
        const entry = this.data[termId];
        if (!entry) {
            console.warn(`TermId "${termId}" not found in mapBibTerms`);
            return '';
        }
        return entry.gloss;   
    }

    getDefinition(termId) {
        const entry = this.data[termId];
        if (!entry) {
  //          console.warn(`TermId "${termId}" not found in mapBibTerms`);
            return '';
        }
        return entry.context;   
    }

    getTransliteration(termId) {
        const entry = this.data[termId];
        if (!entry) {
//            console.warn(`TermId "${termId}" not found in mapBibTerms`);
            return '';
        }
        return entry.transliteration;   
    }

    getRefs(termId) {
        const entry = this.data[termId];
        if (!entry) {
            console.warn(`TermId "${termId}" not found in mapBibTerms`);
            return [];
        }
        return entry.refs || [];   
    }
}

const collectionTerms = new CollectionTerms();
export { collectionTerms };
export default CollectionTerms;