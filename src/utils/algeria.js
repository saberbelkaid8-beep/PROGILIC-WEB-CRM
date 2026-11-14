import locationData from '../data/algeria-locations.json';

export function getWilayasList() {
  return locationData.map(wilaya => ({
    id: wilaya.id,
    name_ar: wilaya.name_ar,
    name_fr: wilaya.name_fr
  }));
}

export function getCommunesForWilaya(wilayaId) {
  if (!wilayaId) return [];
  const wilaya = locationData.find(item => item.id === Number(wilayaId));
  return (wilaya?.communes || []).map(c => ({
    id: c.id,
    name_ar: c.name_ar,
    name_fr: c.name_fr
  }));
}

export function getWilayaByName(name) {
  if (!name) return null;
  const w = locationData.find(item => item.name_ar === name || item.name_fr === name || item.aliases.includes(name));
  return w ? w.id : null;
}
