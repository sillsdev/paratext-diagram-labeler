const allMapData = require('./data/smr-map-defs.json');

function getMapDef(mapId, collPlacenames) {
    // TODO: Dynamically import the JSON file and return the requested map data
    try {
        const mapData = allMapData[mapId];
        if (!mapData) return null;
        if (Array.isArray(mapData.labels)) {
            mapData.labels = mapData.labels.map((label, idx) => ({ ...label, idx, gloss: collPlacenames.getGloss(label.termId) }));
        }
        mapData.template = mapId;
        return { ...mapData };
    } catch (e) {
        console.error('Failed to load smr-map-defs.json:', e);
        return null;
    }
}

export { getMapDef };
