process.env.NODE_TLS_REJECT_UNAUTHORIZED=0;
//const turf = require('@turf/turf');
const axios = require('axios');
const fs = require('fs');
const Promise = require('bluebird');
//const oada = require('@oada/oada-cache');
const oada = require('@oada/client');
const gja = require('@mapbox/geojson-area');
const gh = require('ngeohash');
//const rls2 = require('@radarlabs/s2');
const {fromDEM, fromCounty} = require('./ssurgo');
const s2 = require('s2-geometry');
const wicket = require('wicket');
const gvt = require('geojson-vt');
let tree = require('./tree').soils;

let MAX_LEVEL = 30;
let dist = {};

const DEMFILE='DPAC.tif';
let wkt = new wicket.Wkt();

let CONN;

async function main() {
  CONN = await oada.connect({
    token: 'def',
    domain: 'https://localhost',
    concurrency: 10,
  });
  setInterval(()=> {}, 1000);

  let soils = await fromCounty('IN', 'Tippecanoe', cb);
//  fs.writeFileSync('Tippecanoe.json', JSON.stringify(soils));
//  let soils = JSON.parse(fs.readFileSync('Tippecanoe.json'));
  //let soils = await fromDEM('./DPAC.tif', cb);
  console.log('putting into oada now');
  await toOada(soils);
//  Object.keys(dist).forEach(key => delete dist[key].keys)
//  console.log(dist);
//  await getSeriesDescriptions(soils);
//  await indexSoils(soils);
  process.exit();
}

async function toOada(soils) {
  let resourceIds = {};
  await Promise.each(Object.keys(soils), async (k) => {
    console.log('handling', k);
    if (k === 'mapUnitPolygons') {
      return;
      let mapUnitPolygons = await geohashTileMapUnits(soils[k]);
      soils.mapUnitPolygons = mapUnitPolygons;
//      return;
    }
    let r = await CONN.put({
      path: `/bookmarks/soils/tabular/${k}`,
      tree,
      data: {}
    }).catch((err) => {
      console.log('!!!!!!!!!!!!!!!!!!!');
      console.log(err);
    })

    await Promise.map(Object.keys(soils[k]), async (key) => {
      console.log('item key', key);
      let post = await CONN.post({
        path: `/resources`,
        data: soils[k][key]
      }).catch((err) => {
        console.log('!!!!!!!!!!!!!!!!!!!');
        console.log(err);
      })
      try {
      console.log('a1', post.status, post.headers['content-location'].replace(/^\//, ''))
      resourceIds[key] = post.headers['content-location'].replace(/^\//, '');

      let r = await CONN.put({
        path: `/bookmarks/soils/tabular/${k}/${key}`,
        data: {"_id": resourceIds[key]}
      }).catch((err) => {
        console.log('!!!!!!!!!!!!!!!!!!!');
        console.log(err);
      })
      console.log(k, key, r.status);
      } catch(err) {
        console.log('err', err);
      }
    }, {concurrency: 1000})
  }).catch(err => {
    console.log(err);
  }).then(a => {
    console.log('done now', a);
  })
  console.log('MAKING LINKS');
  // After all resources are made, go back and create links
  let links = {
    mapunits: ['components'],
    components: ['horizons'],
    horizons: ['cokey'],
    comonths: ['cokey'],
    mapUnitPolygons: [],
  }

  await Promise.each(Object.keys(soils), async (k) => {
    console.log('a', k)
    await Promise.each(Object.keys(soils[k]), async (key) => {
      await Promise.each(links[k] || [], async (linkKey) => {
        console.log('c', linkKey)
        if (typeof soils[k][key][linkKey] === 'string') {

          console.log('1', `/bookmarks/soils/tabular/${k}/${key}/${linkKey}`)
          let r = await CONN.put({
            path: `/bookmarks/soils/tabular/${k}/${key}/${linkKey}`,
            data: {_id: resourceIds[key]}
          }).catch((err) => {
            console.log('!!!!!!!!!!!!!!!!!!!');
            console.log(err);
          })
        } else if (typeof soils[k][key][linkKey] === 'array') {
          await Promise.each(soils[k][key][linkKey], async (itemKey) => {
            console.log('2', `/bookmarks/soils/tabular/${k}/${key}/${linkKey}`)
            let r = await CONN.put({
              path: `/bookmarks/soils/tabular/${k}/${key}/${linkKey}`,
              data: {
                [itemKey]: {
                  "_id": resourceIds[key]
                }
              }
            }).catch((err) => {
              console.log('!!!!!!!!!!!!!!!!!!!');
              console.log(err);
            })
          })
        } else {
          await Promise.each(Object.keys(soils[k][key][linkKey] || {}), async (itemKey) => {
            console.log('3', `/bookmarks/soils/tabular/${k}/${key}/${linkKey}`)
            let r = await CONN.put({
              path: `/bookmarks/soils/tabular/${k}/${key}/${linkKey}`,
              data: {
                [itemKey]: {
                  "_id": resourceIds[key]
                }
              }
            }).catch((err) => {
              console.log('!!!!!!!!!!!!!!!!!!!');
              console.log(err);
            })
          })
        }
      })
    }, {concurrency: 25})
  })
}

async function indexSoils(soils) {
  let mapUnitPolygons = soils.mapUnitPolygons;
  console.log('LENGTH', Object.keys(soils.mapUnitPolygons).length)
  let opts = {
    maxZoom: 18,  // max zoom to preserve detail on; can't be higher than 24
    tolerance: 3, // simplification tolerance (higher means simpler)
    extent: 4096, // tile extent (both width and height)
    buffer: 64,   // tile buffer on each side
    debug: 0,     // logging level (0 to disable, 1 or 2)
    lineMetrics: false, // whether to enable line metrics tracking for LineString/MultiLineString features
    promoteId: null,    // name of a feature property to promote to feature.id. Cannot be used with `generateId`
    generateId: false,  // whether to generate feature ids. Cannot be used with `promoteId`
    indexMaxZoom: 5,       // max zoom in the initial tile index
    indexMaxPoints: 100000 // max number of points per tile in the index
  }
  let data = {
    "type": "FeatureCollection",
    "features": Object.keys(mapUnitPolygons).map(key => {
      let geodata = mapUnitPolygons[key];
      geodata.geometry = wkt.read(mapUnitPolygons[key].mupolygongeo).toJson(),
      delete geodata.mupolygonproj
      delete geodata.mupolygongeo;
      geodata.type = "Feature"
      geodata.id = geodata.mukey;
      geodata.key = key;
      return geodata;
    })
  }
  fs.writeFileSync('tippSoil.json', JSON.stringify(data))
  /*
  let tileIndex;
  try { 
    tileIndex = gvt(data, opts);
  } catch(error) {
    console.log(error);
  }

  Object.keys(tileIndex.tiles).map(async key => {
    let { z, x, y } = tileIndex.tiles[key];
    await CONN.put({
      path: `/bookmarks/soils/geospatial/geojson-vt-index/z/${z}/x/${x}/y/${y}`,
      data: tileIndex[tiles],
      tree
    })
  })
  */


  /*
  Object.keys(mapUnitPolygons).forEach((mukey) => {
    mapUnitPolygons[mukey]["mupolygongeo"] = wkt.read(mapUnitPolygons[mukey]["mupolygongeo"]).toJson();
    let geojson = wkt.toJson();
    let area = gja.geometry(geojson);
    let polys;
    if (mapUnitPolygons[mukey]["mupolygongeo"].type === 'Polygon') {
      polys = [mapUnitPolygons[mukey]["mupolygongeo"].coordinates];
    } else {
      polys = mapUnitPolygons[mukey]["mupolygongeo"].coordinates;
    }
    polys.forEach(async (poly) => {
      let key = s2.S2.latLngToKey(poly[0][0], poly[0][1], MAX_LEVEL);
      console.log('level:', 30, 'key:', key, 'length:', key.length-2)
      let id = s2.S2.keyToId(key);
      let parts = key.split('/');
      let face = parts[0]
      let position = parts[1];
      let cell = s2.S2.facePosLevelToId(face, position, MAX_LEVEL)
      poly[0].pop();


      const s2LLs = poly[0].map(([lat, lng]) => (new rls2.LatLng(lat, lng)));

      let keyStrings = poly[0].map(([lat, lng]) => s2.S2.latLngToKey(lat, lng, 30))
      let minCommonString = longestCommonPrefix(keyStrings);
      console.log(minCommonString);
      dist[(minCommonString.length-2).toString()] = dist[(minCommonString.length-2).toString()] || {
        count: 0,
        sum: 0,
        s_sum: 0,
      };
      dist[(minCommonString.length-2).toString()].count++;
      dist[(minCommonString.length-2).toString()].sum += area;
      dist[(minCommonString.length-2).toString()].mean = dist[(minCommonString.length-2).toString()].sum/dist[(minCommonString.length-2).toString()].count;
      let geo = {type: 'Polygon', coordinates: [[]]};
      for (let i = 0; i < 4; i++) {
        let {lat, lng} = s2.S2.keyToLatLng(minCommonString+i.toString())
        geo.coordinates[0].push([lat, lng]);
      }
      let {lat, lng} = s2.S2.keyToLatLng(minCommonString+'0')
      geo.coordinates[0].push([lat, lng]);
      let size = gja.geometry(geo);
      dist[(minCommonString.length-2).toString()].s_sum += size;
      dist[(minCommonString.length-2).toString()].mean_size = dist[(minCommonString.length-2).toString()].s_sum/dist[(minCommonString.length-2).toString()].count;

      const s2level = 14;
      const covering = rls2.RegionCoverer.getCoveringTokens(s2LLs, { min: 10, max: 20 });
      console.log('covering', covering);
      
      console.log({path: `/bookmarks/soils/geospatial/map-units/geohash-contain/${minCommonString.length-2}/geohash-index/${minCommonString}`})

      await oada.put({
        path: `/bookmarks/soils/geospatial/s2-map-unit-contains/geohash-length-index/${minCommonString.length-2}/geohash-index/${minCommonString}`,
        tree,
        data
      })

    })
  })
  */
  //rls2.RegionCoverer(
}

async function geohashTileMapUnits(mapUnitPolygons) {
  let sevens = {};
  await Promise.each(Object.keys(mapUnitPolygons), async (mupkey, i) => {
    let geojson  = wkt.read(mapUnitPolygons[mupkey]["mupolygongeo"]).toJson();
    let area = parseFloat(mapUnitPolygons[mupkey].muareaacres);
    let polys;
    if (geojson.type === 'Polygon') {
      polys = [geojson.coordinates];
    } else {
      polys = geojson.coordinates;
    }
    mapUnitPolygons[mupkey].geojson = geojson;
    console.log('geojson', mapUnitPolygons[mupkey].geojson)
    await Promise.each(polys, async poly => {
      let keyStrings = poly[0].map(([lng, lat]) => {
        let hash = gh.encode(lat, lng)
        return gh.encode(lat, lng)})
      let minCommonString = longestCommonPrefix(keyStrings);
      dist[(minCommonString.length-2).toString()] = dist[(minCommonString.length-2).toString()] || {
        count: 0,
        sum: 0,
        s_sum: 0,
        keys: {},
      };
      dist[(minCommonString.length-2).toString()].count++;
      dist[(minCommonString.length-2).toString()].sum += area;
      dist[(minCommonString.length-2).toString()].mean = dist[(minCommonString.length-2).toString()].sum/dist[(minCommonString.length-2).toString()].count;
      dist[(minCommonString.length-2).toString()].keys[minCommonString] = true;
      dist[(minCommonString.length-2).toString()].keyCount = Object.keys(dist[(minCommonString.length-2).toString()].keys).length

      //Instead, get the geohash-7 encoding of each and every point in the polygon,
      //make an index of the geohashes the polygon touches, and then write them all to oada
      keyStrings = poly[0]
        .map(([lng, lat]) => gh.encode(lat, lng, precision=7))
        .filter((x, i, a) => a.indexOf(x) === i)


      await Promise.each(keyStrings, async hash => {
        sevens[hash] = sevens[hash] || {
          "map-unit-polygons": {}
        }
        sevens[hash]["map-unit-polygons"][mupkey] = mupkey;
      })
    })
  })

  let targets = [
  'dp4nk94', 'dp4nk95', 'dp4nk9h',
    'dp4nk9j', 'dp4nk9n', 'dp4nk9p',
    'dp4nk96', 'dp4nk97', 'dp4nk9k',
    'dp4nk9m', 'dp4nk9q', 'dp4nk9r',
    'dp4nk9d', 'dp4nk9e', 'dp4nk9s',
    'dp4nk9t', 'dp4nk9w', 'dp4nk9x',
    'dp4nk9f', 'dp4nk9g', 'dp4nk9u',
    'dp4nk9v', 'dp4nk9y', 'dp4nk9z',
    'dp4nkd4', 'dp4nkd5', 'dp4nkdh',
    'dp4nkdj', 'dp4nkdn', 'dp4nkdp'
  ]

  await Promise.each(Object.keys(sevens), async (hash, i) => {
    if (targets.indexOf(hash) < 0) return
    let gh5 = hash.slice(0,5);

    let resp = await CONN.put({
      path: `/bookmarks/soils/tiled-maps/ssurgo-map-units/geohash-5-index/${gh5}/geohash-index/${hash}`,
      data: sevens[hash],
      tree
    }).catch(err => console.log(err))
  })
  return mapUnitPolygons
}

function longestCommonPrefix(strings) {
  let A = strings.concat().sort(), 
  a1= A[0], 
  a2= A[A.length-1], 
  L= a1.length, 
  i= 0;
  while(i < L && a1.charAt(i) === a2.charAt(i)) i++;
  return a1.substring(0, i);
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

async function getSeriesDescriptions(soils) {
  return Promise.map(Object.keys(soils.component), async (cokey) => {
    await CONN.put({
      path: `/bookmarks/soils/tabular/component/${cokey}`,
      data: soils.component[cokey],
      type: 'application/vnd.oada.soils.1+json',
    })
    if (soils.component[cokey].compname) {
      let name = soils.component[cokey].compname;
      let response = await axios({
        method: 'get',
        url: `https://casoilresource.lawr.ucdavis.edu/api/soil-series.php?q=all&s=${name}`
      })
      let series = response.data
      if (series.site) {
        name = name.replace(/\s+/g, '-')
        await CONN.put({
          path: `/bookmarks/soils/tabular/official-series-descriptions/${name}`,
          data: series,
          type: 'application/json',
          tree,
        })
      } else {
        console.log('NO SERIES DESCRIPTION FOR', cokey)
      }
    } else {
      console.log('THIS ONE FAILED', soils.component[cokey]);
    }
  })
}

async function cb(mapUnitPolygon) {
  console.log('test');
  let resp = await CONN.put({
    tree,
    path: `/bookmarks/soils/geospatial/raw/mupolygon/${mapUnitPolygon.mupolygonkey}`,
    data: mapUnitPolygon
  })
}

main();
//console.log(rls2)
