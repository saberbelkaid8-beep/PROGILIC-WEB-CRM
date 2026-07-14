import * as loc from 'algeria-locations';

export function getWilayasList() {
  return loc.getWilayas().map(w => ({
    id: w.id,
    name_ar: w.name_ar,
    name_fr: w.name
  }));
}

export function getCommunesForWilaya(wilayaId) {
  if (!wilayaId) return [];
  return loc.getCommunesByWilayaId(Number(wilayaId)).map(c => ({
    id: c.id,
    name_ar: c.name_ar,
    name_fr: c.name
  }));
}

export function getWilayaByName(name) {
  if (!name) return null;
  const w = loc.getWilayas().find(x => x.name_ar === name || x.name === name);
  return w ? w.id : null;
}
