import mapBibTerms from './data/smr-term-list.json';

class MapBibTerms {
    constructor() {
        this.data = mapBibTerms;
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
            console.warn(`TermId "${termId}" not found in mapBibTerms`);
            return '';
        }
        return entry.context;   
    }

    getTransliteration(termId) {
        const entry = this.data[termId];
        if (!entry) {
            console.warn(`TermId "${termId}" not found in mapBibTerms`);
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

export default MapBibTerms;