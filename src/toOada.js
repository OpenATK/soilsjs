process.env.NODE_TLS_REJECT_UNAUTHORIZED=0;
const Promise = require('bluebird');
const oada = require('@oada/oada-cache');
const {fromDEM, fromCounty} = require('./ssurgo');
const s2 = require('s2-geometry');
const wicket = require('wicket');
let tree = require('./tree');

const DEMFILE='DPAC.tif';
let wkt = new wicket.Wkt();

let CONN;

//
async function main() {
  CONN = await oada.connect({
    token: 'def',
    domain: 'https://localhost',
  });

  let soils = await fromCounty('IN', 'Tippecanoe', cb);
  //let soils = await fromDEM('./DPAC.tif', cb);
  await toOada(soils);
//  await indexSoils(soils);
  process.exit();
}

async function toOada(soils) {
  return Promise.each(Object.keys(soils), (k) => {
    if (k === 'mapUnitPolygons') return;
    return Promise.each(Object.keys(soils[k]), (key) => {
      return CONN.put({
        path: `/bookmarks/soils/tabular/${k}/${key}`,
        tree,
        data: soils[k][key]
      }).catch((err) => {
        console.log('!!!!!!!!!!!!!!!!!!!');
        console.log(err);
      })
    })
  })
}

async function indexSoils(soils) {
  let mapUnitData = soils.mapUnitData;
  Object.keys(mapUnitData).forEach((mukey) => {
    mapUnitData[mukey]["AoiSoilMapUnitPolygonGeo"] = wkt.read(mapUnitData[mukey]["AoiSoilMapUnitPolygonGeo"]).toJson();
    if (mapUnitData[mukey]["AoiSoilMapUnitPolygonGeo"].type === 'Polygon') {
      let poly = mapUnitData[mukey]["AoiSoilMapUnitPolygonGeo"].coordinates;
      poly.forEach((poly) => {
        [23,24].forEach((lev) => {
          let key = s2.S2.latLngToKey(poly[0][0], poly[0][1], lev);
          console.log('key level', lev, key)
        })
      })
    } else {
      mapUnitData[mukey]["AoiSoilMapUnitPolygonGeo"].coordinates.forEach((poly) => {
        poly.forEach((poly) => {
          [23,24].forEach((lev) => {
            let key = s2.S2.latLngToKey(poly[0][0], poly[0][1], lev);
            console.log('key level', lev, key)
          })
        })
      })
    }
  })
}

async function toQuadTiles(soils) {
  console.log(s2);
  let mapUnitData = soils.mapUnitData;
  Object.keys(mapUnitData).forEach((mukey) => {
    mapUnitData[mukey]["AoiSoilMapUnitPolygonGeo"] = wkt.read(mapUnitData[mukey]["AoiSoilMapUnitPolygonGeo"]).toJson();
    if (mapUnitData[mukey]["AoiSoilMapUnitPolygonGeo"].type === 'Polygon') {
      let poly = mapUnitData[mukey]["AoiSoilMapUnitPolygonGeo"].coordinates;
      poly.forEach((poly) => {
        [23,24].forEach((lev) => {
          console.log('````````````', lev)
          let key = s2.S2.latLngToKey(poly[0][0], poly[0][1], lev);
          console.log('key level', lev, key)

          let id = s2.S2.keyToId(key);
          console.log('id', id)

          let backtoid = s2.S2.idToKey(id);
          console.log('backtoid', backtoid);

          let hilbertquadkey = s2.S2.toHilbertQuadkey(id);
          console.log('hilbertquadkey', hilbertquadkey);

          let quadkey = s2.S2.latLngToQuadkey(poly[0][0], poly[0][1],18);
          console.log('hilbertquadkey', quadkey);
        })
      })
    } else {
      mapUnitData[mukey]["AoiSoilMapUnitPolygonGeo"].coordinates.forEach((poly) => {
        poly.forEach((poly) => {
          [23,24].forEach((lev) => {
            console.log('````````````', lev)
            let key = s2.S2.latLngToKey(poly[0][0], poly[0][1], lev);
            console.log('key level', lev, key)

            let id = s2.S2.keyToId(key);
            console.log('id', id)

            let backtoid = s2.S2.idToKey(id);
            console.log('backtoid', backtoid);

            let hilbertquadkey = s2.S2.toHilbertQuadkey(id);
            console.log('hilbertquadkey', hilbertquadkey);
          })
        })
      })
    }
  })
}

async function tabularToOada(soils) {
  return Promise.map(Object.keys(soils.mapUnitData), async (mukey) => {
    let obj = _.cloneDeep(soils.mapUnitData[mukey]);
    delete obj.AoiSoilMapUnitPOlygonGeo;
    await CONN.put({
      path: `/bookmarks/soils/tabular/map-units/${mukey}`,
      data: soils.mapUnitData[mukey],
      type: 'application/vnd.oada.soils.1+json',
    })
  }).then(async () => {
    return Promise.map(Object.keys(soils.componentData), async (cokey) => {
      await CONN.put({
        path: `/bookmarks/soils/tabular/components/${cokey}`,
        data: soils.componentData[cokey],
        type: 'application/vnd.oada.soils.1+json',
      })
    })
  }).then(async () => {
    return Promise.map(Object.keys(soils.horizonData), async (chkey) => {
      await CONN.put({
        path: `/bookmarks/soils/tabular/horizons/${chkey}`,
        data: soils.horizonData[chkey],
        type: 'application/vnd.oada.soils.1+json',
      })
    })
  })
}

async function cb(mapUnitPolygon) {
  let resp = await CONN.put({
    tree,
    path: `/bookmarks/soils/geospatial/raw/mupolygon/${mapUnitPolygon.mupolygonkey}`,
    data: mapUnitPolygon
  })
}

main();
