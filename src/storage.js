const KEY_V2 = "resource_vault_v2";
const KEY_V1 = "resource_vault_v1";

export function load(){
  // v2
  try{
    const raw2 = localStorage.getItem(KEY_V2);
    if (raw2) return JSON.parse(raw2);
  }catch{}

  // migration from v1
  try{
    const raw1 = localStorage.getItem(KEY_V1);
    if (!raw1) return null;
    const v1 = JSON.parse(raw1);

    const migrated = {
      version: 2,
      items: Array.isArray(v1.items) ? v1.items : [],
      collections: Array.isArray(v1.collections) ? v1.collections : [],
    };

    localStorage.setItem(KEY_V2, JSON.stringify(migrated));
    return migrated;
  }catch{
    return null;
  }
}

export function save(data){
  localStorage.setItem(KEY_V2, JSON.stringify({ version: 2, ...data }));
}
