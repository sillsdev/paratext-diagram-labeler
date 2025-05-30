import mapBibTerms from './data/smr-term-list.json';

class MapBibTerms {
    constructor(language = 'en') {
        this.data = mapBibTerms;
        this.language = language;
    }
    
    getGloss(termId) {
        const entry = this.data[termId];
        if (!entry) {
            console.warn(`TermId "${termId}" not found in mapBibTerms`);
            return '';
        }
        return entry.gloss[this.language] || entry.gloss['en'] || '';   
    }

    getDefinition(termId) {
        const entry = this.data[termId];
        if (!entry) {
            console.warn(`TermId "${termId}" not found in mapBibTerms`);
            return '';
        }
        return entry.context[this.language] || entry.gloss['en'] || '';   
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