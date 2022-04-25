const pointer = require('json-pointer');
const wellknown = require('wellknown');
//const _ = require('lodash');
const turf = require('@turf/turf');
const fips = require('fips-county-codes');
const fs = require('fs');
const ar = require('axios-retry');
const axios = require('axios');
const debug = require('debug');

const info = debug('soilsjs:info');
const trace = debug('soilsjs:trace');
const error = debug('soilsjs:error');

let defaultConfig = [
  'mupolygon',
  'mapunit',
  'component',
  'chorizon'
];

// For whatever reason, the soil data mart web service frequently errors with ECONNRESET 
ar(axios, {retries: 3, retryCondition: function(error) {
  if (error.code === 'ECONNRESET') {
    error('ECONNRESET Error, Retrying...');
    return error.code === 'ECONNRESET';
  } else return false;
}})

function parseQueryResult(table, keyname) {
  if (table === undefined) throw new Error('Resulting data table is undefined');
  let headers = table.shift();
  //@ts-ignore
  let metadata = table.shift();
  // The remainder of the array are the results
  let rows = table;
  let objData = {};
  let arrayData = rows.map((row) => {
    let obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    })
    let key = obj[keyname];
    if (keyname) objData[key] = obj;
    return obj;
  })
  return {arrayData, objData}
}

async function fromCounty(state, county, {config}) {
  config = config || defaultConfig;
  let fip = fips.get({
    state,
    county
  })
  let areaSymbol = state+fip.fips.substr(2);
  info(`Using AreaSymbol ${areaSymbol}`);
  return fromAreaSymbol(areaSymbol, config);
}

// The WKT string itself won't work, it must be surrounded by single quotes, e.g., 'x'
async function fromWkt(wkt, {config, aggregate}) {
  config = config || defaultConfig;
  let ssurgoWkt = `'${wkt}'`; // HERE IS THE MODIFICATION NECESSARY FOR THEIR API
  let QUERY = `SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84(${ssurgoWkt})`;
  trace(`Generated query: ${QUERY}`) 
  let response = await axios({
    method: "post", 
    url: "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?",
    data: {
      'SERVICE': 'query',
      'REQUEST': 'query',
      QUERY, 
      'FORMAT': 'JSON+COLUMNNAME+METADATA'
    }
  })
  let table = response.data.Table;
  let result = parseQueryResult(table, 'mukey');
  let mukeys = result.objData;

  let obj = await fetchDataFromMukeys(mukeys, config); 

  //2. Get geospatial polygon data for map units
  if (!config || !(config!.mupolygon === false)) {
    obj.mupolygon = {};
    // Get polygon data
    let table = await axios({
      method: "post", 
      url: "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?",
      data: {
        QUERY: `SELECT * FROM SDA_Get_Mupolygonkey_from_intersection_with_WktWgs84(${ssurgoWkt})`, 
        FORMAT: 'JSON+COLUMNNAME+METADATA'
      }
    })
    .then(r => r.data.Table)
    let result = parseQueryResult(table, 'mupolygonkey');
    result.arrayData.forEach(p => {
      obj.mupolygon[p.mupolygonkey] = p;
    })


    table = await axios({
      method: "post", 
      url: "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?",
      data: {
        QUERY: `SELECT * from mupolygon where mupolygonkey IN (${Object.keys(obj.mupolygon).join(',')})`,
        FORMAT: 'JSON+COLUMNNAME+METADATA'
      }
    })
    .then(r => r.data.Table)
    .catch(async (err) => {
      if (err.response.status === 500) {
        if (typeof err.response.data === 'string' && err.response.data.includes("Error during serialization or deserialization using the JSON JavaScriptSerializer. The length of the string exceeds the value set on the maxJsonLength property")) {
          let queryString = `SELECT * from mupolygon where mupolygonkey IN ()`;
          return catchMaxJson(queryString, Object.keys(obj.mupolygon), []) 
        }
      }
      error(err);
      throw err;
    })
    result = parseQueryResult(table, 'mupolygonkey');
    let objData = result.objData;
    obj.mupolygon = objData;
  }

  if (aggregate) {
    let agg = await _aggregate(obj, wkt)
    Object.assign(obj, agg)
  }
  return obj;
}


async function query(QUERY, opts?) {
  //1. Get geospatial data

  let data = {
    QUERY,
    FORMAT: opts && opts.format ? opts.format : 'JSON+COLUMNNAME+METADATA',
  }
  if (opts && opts.service) {
    //@ts-ignore
    data.SERVICE = opts.service;
  }
  return await axios({
    method: "post",
    url: opts && opts.url ? opts.url : "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?",
    data,
  })
}

//Fetch map unit keys from area symbol
// By default, config will always return map units, map unit polygons, components, 
// and horizons. The config is used to optionally a) omit particular data tables
// or b) retrieve deeper tables beyond those top-level ones
async function fromAreaSymbol(areaSymbol, config) {
  //1. Get geospatial data
  let response = await axios({
    method: "post",
    url: "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?",
    data: {
      'QUERY': `SELECT mukey from mupolygon where areasymbol IN ('${areaSymbol}')`,
      'FORMAT': 'JSON+COLUMNNAME+METADATA'
    }
  })
  let table = response.data.Table;
  let result = parseQueryResult(table, 'mukey');
  let mukeys = result.objData;

  let obj = await fetchDataFromMukeys(mukeys, config); 

  //2. Get geospatial polygon data for map units
  if (!config || !(config!.mupolygon === false)) {
    obj.mupolygon = {};
    // Get polygon data
    let table = await axios({
      method: "post", 
      url: "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?",
      data: {
        QUERY: `SELECT * from mupolygon where mukey IN (${Object.keys(mukeys).join(',')}) and areasymbol IN ('${areaSymbol}')`,
        FORMAT: 'JSON+COLUMNNAME+METADATA'
      }
    })
    .then(r => r.data.Table)
    .catch(async (err) => {
      if (err.response.status === 500) {
        if (typeof err.response.data === 'string' && err.response.data.includes("Error during serialization or deserialization using the JSON JavaScriptSerializer. The length of the string exceeds the value set on the maxJsonLength property")) {
          let queryString = `SELECT * from mupolygon where mukey IN () and areasymbol IN ('${areaSymbol}')`;
          return catchMaxJson(queryString, Object.keys(mukeys), []) 
        }
      }
      error(err);
      throw err;
    })
    let result = parseQueryResult(table, 'mupolygonkey');
    result.arrayData.forEach(p => {
      obj.mupolygon[p.mupolygonkey] = p;
    })
  }
  return obj;
}

async function recursiveGetSubTables(obj, config, path, reindex?) {
  trace(`Retreiving data via recursiveGetSubTables...path: ${path}, keys: ${Object.keys(obj)}`);
  // Get the config and data for this level;
  let newConfig = pointer.get(config, path);
  let pieces = pointer.parse(path);
  let parentKey = pieces[pieces.length-1];
  let parentData = pointer.get(obj, `/${parentKey}`)
  // Get the keys in the config at this level; these are the tables to retreive
  reindex = reindex || {};
  for (const key in newConfig) {
    // Retreive the data for those tables
    obj[key] = await getSubTable(parentData, key, reindex[key]);
    await recursiveGetSubTables(obj, config, `${path}/${key}`, reindex)
  }
}

async function nonRecursiveGetSubTables(obj, config) {
  //1. Find the path where this key occurs
  //2. json pointer set it to empty obj {}
  //3. Hand the compiled object off to recursiveGetSubTables

  // Iterate over the list of tables in the config
  let conf = {};
  config.forEach((key) => {
    // Retreive the data for those tables
    let path = recursiveFind(tableTree, key.toUpperCase(), '');
    path += `/${key.toUpperCase()}`;
    pointer.set(conf, path.toLowerCase(), {})
  })
  await recursiveGetSubTables(obj, conf, `/mapunit`, config.reindex)
}

async function fetchDataFromMukeys(mukeys, config) {
  let obj : any = {};

  // Get map units
  let res = await axios({
    method: 'post',
    url: "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?",
    data: {
      'QUERY': `SELECT * from mapunit where mukey IN (${Object.keys(mukeys).join(',')})`,
      'FORMAT': 'JSON+COLUMNNAME+METADATA'
    }
  })
  let table = res.data.Table;
  let result = parseQueryResult(table, 'mukey');
  obj.mapunit = result.objData;

  // Start at mapunits and traverse + retrieve any desired tables
  if (Array.isArray(config)) {
    await nonRecursiveGetSubTables(obj, config)
  } else if (typeof config === 'object' && !Buffer.isBuffer(config)) {
    await recursiveGetSubTables(obj, config, `/mapunit`, config.reindex)
  }

  // Prune any unrequested data
  if (config && config) {
    Object.keys(obj).forEach((key) => {
      if (!config.includes(key)) {
        delete obj[key]
      }
    })
  }
  return obj;
}

function recursiveFind(obj, findKey, path) {
  let result;
  for (const key in obj) {
    if (key === findKey) {
      result = path;
      break;
    } else {
      if (typeof obj[key] === 'object' && Object.keys(obj[key]).length > 0) {
        let resObj = recursiveFind(obj[key], findKey, `${path}/${key}`);
        if (resObj) return resObj
      }
    }
  }
  return result;
}

function nestData({parent, data, childKeyName, parentKeyName, childTableName, childIndexKey}) {
  info(`Nesting data. childKeyName: ${childKeyName}, parentKeyName: ${parentKeyName}, childTableName: [${childTableName}] childIndexKey: ${childIndexKey}`)
  //@ts-ignore
  data.forEach((item) => {
    let {[childKeyName]: cKey, [parentKeyName]: pKey} = item;
    parent[pKey][childTableName] = parent[pKey][childTableName] || {};

    childIndexKey = childIndexKey || childKeyName;
    let childIndexValue = item[childIndexKey];
    trace(`Nesting childIndexValue [${childIndexValue}] childIndexKey [${childIndexKey}]`)
    parent[pKey][childTableName][childIndexValue] = cKey; 
  })
}

function parentTableFromChildName(name) {
  let path = recursiveFind(tableTree, name.toUpperCase(), '');
  if (!path) throw new Error(`Could not find parent table for ${name}`)
  let pieces = pointer.parse(path)
  let parentTable = pieces[pieces.length-1];

  return parentTable;
}

async function getSubTable(parentData, childTableName, childIndexKey?) {
  info(`Retrieving ${childTableName} data...`);
  let parentTableName = parentTableFromChildName(childTableName);
  let parentKeyName = tableNameToKeyName(parentTableName).toLowerCase();
  let childKeyName = tableNameToKeyName(childTableName).toLowerCase();

  let url = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?SERVICE=query&REQUEST=query";
  let data = {
    "QUERY":`SELECT * FROM ${childTableName} WHERE ${parentKeyName} IN (${Object.keys(parentData).join(",")})`,
    "FORMAT": "JSON+COLUMNNAME+METADATA"
  };
  let method = "post";
  let response = await axios({method, url, data});
  let table = response.data.Table;

  let result = parseQueryResult(table, childKeyName);
  let objData = result.objData;

  //Modify the parent data to include the child data
  //@ts-ignore
  parentData = nestData({
    parent: parentData,
    data: result.arrayData,
    //parentKeyName: parentKeyName.toLowerCase(),
    parentKeyName,
    childTableName,
    //childKeyName: childKeyName.toLowerCase(),
    childKeyName,
    childIndexKey,
  })
  /*
  result.arrayData.forEach(({[childKeyName]: cKey, [parentKeyName]: pKey}) => {
    parentData[pKey][childTableName] = parentData[pKey][childTableName] || {};
    parentData[pKey][childTableName][childIndexKey || cKey] = cKey; 
  })
 */
  // return the child data table
  return objData;
}

async function catchMaxJson(queryString, items, table) {
  info('Handling error with catchMaxJson. Dividing items into smaller chunks.')
  //1. Get the number of items 
  let increment = Math.floor(items.length/4);
  let remainder = items.length%4;
  // Divide into 4 groups
  for (let i = 0; i < 5; i++) {
    let start = ((items.length-remainder)/4)*i;
    let end = (((items.length-remainder)/4)*i) + increment;
    if (i === 4) {
      if (remainder === 0) {
        continue;
      } else {
        end = items.length;
      }
    }
    let keys = items.slice(start, end)

    let Q = queryString.replace(/IN \(\)/, `IN (${keys.join(',')})`)

    await axios({
      method: "post", 
      url: "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?",
      data: {
        QUERY: Q,
        'FORMAT': 'JSON+COLUMNNAME+METADATA'
      }
    // recursively repeat if it fails again
    }).then((resp) => {
      info(`Smaller increment succeeded:`, {increment, startingIndex:start, endingIndex: end})
      let t = resp.data.Table;
      // Append the table results to the second table
      if (table.length > 0) {
        //Remove the first item
        t.shift();
        table.push(...t);
      } else table = t;
      return table;
    }).catch(async (er) => {
      info(`Smaller increment failed:`, {increment, startingIndex:start, endingIndex: end})
      if (er.response.status === 500) {
        if (typeof er.response.data === 'string' && er.response.data.includes("Error during serialization or deserialization using the JSON JavaScriptSerializer. The length of the string exceeds the value set on the maxJsonLength property")) {
          return catchMaxJson(queryString, keys, table) 
        }
      }
      error(er);
      throw er;
    })
  }
  return table;
}


/*
async function getComponentData(mapunits) {
  let url = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?SERVICE=query&REQUEST=query";
  let data = {
    "QUERY":`SELECT * FROM component WHERE mukey IN (${Object.keys(mapunits).join(",")})`,
    "FORMAT": "JSON+COLUMNNAME+METADATA"
  };
  let method = "post";
  let response = await axios({method, url, data});
  let table = response.data.Table;

  let result = parseQueryResult(table, 'cokey');
  let component = result.objData;

  //Also add component data to the map units
  result.arrayData.forEach(({cokey, mukey}) => {
    mapunits[mukey]["components"] = mapunits[mukey]["components"] || {};
    mapunits[mukey]["components"][cokey] = cokey; 
  })
  return component;
}

async function getHorizonData(components) {
  let url = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest?SERVICE=query&REQUEST=query";
  let data = {
    "QUERY": `SELECT * FROM chorizon WHERE cokey IN (${Object.keys(components).join(",")})`,
    "FORMAT": "JSON+COLUMNNAME+METADATA"
  }
  let method = "post";
  let response;
  try {
    response = await axios({method, url, data});
  } catch (err) {
    error(err);
  }
  let table = response.data.Table;
  let result = parseQueryResult(table, 'chkey')
  let horizon = result.objData;

  result.arrayData.forEach(({chkey, cokey}) => {
    components[cokey].horizons = components[cokey].horizons || {};
    components[cokey].horizons[chkey] = chkey;
    components[cokey].horizonsOrder = components[cokey].horizonsOrder || [];
    components[cokey].horizonsOrder.push(chkey);
    components[cokey].horizonsOrder = _.sortBy(components[cokey].horizonsOrder, 'hzdept_r');
  })
  return horizon;
}

async function newAoiid(boundary, name) {
  let accessed = moment().format();
  let aoiid = await aoiFromDem()
  return aoiid
}
async function fromAoi(wkt) {
  let w = `'polygon((-86.7302676178553 40.4031488400723, -86.7302713805371 40.4032666167283, -86.7303980022839 40.4035503896778, -86.7303774411828 40.4036807296437, -86.7303165534701 40.4037264832885, -86.7301845989508 40.4037311353392, -86.7299436537218 40.4036649894988, -86.7298337880099 40.403619241858, -86.7296261195992 40.4034443198906, -86.7295670365752 40.403375396507, -86.7295487963104 40.4033229296444, -86.7295891651778 40.4032971947975, -86.7296751509818 40.4031779428205, -86.7297926075345 40.4030645919529, -86.7299309407755 40.402974302328, -86.7300830258591 40.4029800998273, -86.7301991374799 40.40306039039, -86.7302676178553 40.4031488400723))'`
  let aoiid = await fromWktAoi(w);
//  let mapunit = await mapUnitDataFromAoiid(aoiid);
  let {mapunits, mupolygon} = await mapUnitDataFromWkt(wkt);
  let components = await getComponentData(mapunits);
  let horizons = await getHorizonData(components);
  return {mapunits, mupolygon, components, horizons}
}
async function fromWktAoi(AOICOORDS) {
  let url = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest";
  let data = {
    AOICOORDS,
    "SERVICE": "aoi",
    "REQUEST": "create",
  }
  let method = "post";
  let response = await axios({method, url, data});

  return response.data.id;
}

async function aoiFromDem(demfile) {
  let ds = gdal.open(demfile);
  let pta = utils.pixelToWorld(ds.geoTransform, 0,0)
  let ptb = utils.pixelToWorld(ds.geoTransform, ds.rasterSize.x, ds.rasterSize.y)

  let source = ds.srs;
  let target = gdal.SpatialReference.fromEPSG(4326);
  let trans = new gdal.CoordinateTransformation(source, target);

  let latlngA = trans.transformPoint(pta.x, pta.y);
  let latlngB = trans.transformPoint(ptb.x, ptb.y);
  let minLat = Math.min(latlngA.y, latlngB.y);
  let maxLat = Math.max(latlngA.y, latlngB.y);
  let minLon = Math.min(latlngA.x, latlngB.x);
  let maxLon = Math.max(latlngA.x, latlngB.x);
  let AOICOORDS = `POLYGON ((${minLon} ${minLat}, ${minLon} ${maxLat}, ${maxLon} ${maxLat}, ${maxLon} ${minLat}, ${minLon} ${minLat}))`;

  let url = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest";
  let data = {
    AOICOORDS,
    "SERVICE": "aoi",
    "REQUEST": "create",
  }
  let method = "post";
  let response;
  response = await axios({method, url, data});

  return response.data.id;
}
*/

//TODO: Consider returning just the aggregate object content, then using
// Object.assign to merge it into the soils object outside of this function.
export function _aggregate(soils, wkt) {
  let aoi = wellknown.parse(wkt);
  info(`Retreiving SSURGO soil data for the AOI`);
  //1. Get bbox of AOI
  let poly = turf.polygon(aoi.coordinates);
  let totalArea = turf.area(poly);;

  let out : any = {
    mapunit: {},
    component: {}
  };

  //1. Start with finding area of each map unit via map unit polygons;
  Object.values(soils.mupolygon || {}).forEach((mup: any) => {
    let { mupolygongeo, mukey, mupolygonkey } = mup;
    let geojson = wellknown.parse(mupolygongeo);
    let polygon = turf.polygon(geojson.coordinates);
    let geom = turf.intersect(polygon, poly)

    if (geom) {
      let area = turf.area(geom);
      out.mapunit[mukey] = out.mapunit[mukey] || {mukey};
      out.mapunit[mukey].aggregate = out.mapunit[mukey].aggregate || {
        area: {
          sum: 0,
          percent: 0,
        },
        mupolygon: {},
        chorizon: {},
        component: {
          percent_sum: 0
        }
      }
      out.mapunit[mukey].aggregate.area.sum += area
      out.mapunit[mukey].aggregate.area.percent = out.mapunit[mukey].aggregate.area.sum/totalArea;
      out.mapunit[mukey].aggregate.mupolygon[mupolygonkey] = {
        mupolygonkey,
        area: {
          sum: area,
          percent: area/totalArea,
        },
        geometry: geom
      }
    }
  })

  //2. Figure out percentage of each component. Components can occur in many
  //   different mapunits.
  Object.keys(soils.mapunit || {}).forEach((mukey) => {
    let mapunit = soils.mapunit[mukey];
    let knownCompQuant = {
      count: 0,
      sum: 0
    };

    //Determine if some components are missing comppct
    Object.keys(mapunit.component).map((cokey) => {
      let component = soils.component[cokey];
      if (parseFloat(component.comppct_r)) {
        knownCompQuant.sum += parseFloat(component.comppct_r);
      } else {
        knownCompQuant.count++;
      }
    })

    Object.keys(mapunit.component || {}).forEach((cokey) => {
      let component = soils.component[cokey];

      // component percent is either the listed percent or equally-split
      // proportion of the components that have no listed percent;
      let component_percent = (parseFloat(component.comppct_r) || ((100-knownCompQuant.sum)/knownCompQuant.count))/100;
      out.mapunit[mukey].aggregate.component.percent_sum += component_percent;
      out.component[cokey] = out.component[cokey] || {cokey};
      out.component[cokey].aggregate = out.component[cokey].aggregate || {
        area: {
          sum: 0,
        },
        chorizon: {
          hzthk_r: {
            sum: 0
          }
        }
      }
      out.component[cokey].aggregate.area.sum += out.mapunit[mukey].aggregate.area.sum*component_percent;
      out.component[cokey].aggregate.area.percent = out.component[cokey].aggregate.area.sum/totalArea;

      //TODO: Some components have no horizons...shouldn't be a problem at this
      // stage, but mostly at the point of aggregating horizon-level component
      //3. Get horizons. Depth-order should be achieved by sorting the keys;
      Object.keys(component.chorizon || {}).sort().forEach(async (chkey) => {
        let horizon = soils.chorizon[chkey];

        // All aggregations will be based weighted based on representative 
        // horizon thickness value
        let weight = parseFloat(horizon.hzthk_r);
        out.component[cokey].aggregate.chorizon.hzthk_r.sum += weight;

        // Aggregate horizon data up to component;
        let skips = ["hzthk_r"]
        Object.keys(horizon).forEach((key) => {
          if (!key.includes("key") && !skips.includes(key)) {
            if (parseFloat(horizon[key])) {
              // Computed Weighted values for component
              out.component[cokey].aggregate.chorizon[key] = out.component[cokey].aggregate.chorizon[key] || {
                weightedSum: 0,
                sumWeight: 0
              };
              out.component[cokey].aggregate.chorizon[key].weightedSum += weight*horizon[key];
              out.component[cokey].aggregate.chorizon[key].sumWeight += out.component[cokey].aggregate.chorizon.hzthk_r.sum;
              out.component[cokey].aggregate.chorizon[key].value = out.component[cokey].aggregate.chorizon[key].weightedSum/out.component[cokey].aggregate.chorizon[key].sumWeight;
            }
          }
        })
      })

      // Aggregate horizon data up to map unit 
      let skips = ["hzthk_r"]
      let horizonkeys = Object.keys(out.component[cokey].aggregate.chorizon).filter(key => !skips.includes(key));
      horizonkeys.forEach((key) => {
        out.mapunit[mukey].aggregate.chorizon[key] = out.mapunit[mukey].aggregate.chorizon[key] || {
          weightedSum: 0,
          sumWeight: 0
        };
        out.mapunit[mukey].aggregate.chorizon[key].weightedSum += out.component[cokey].aggregate.chorizon[key].value*component_percent;
        out.mapunit[mukey].aggregate.chorizon[key].sumWeight = out.mapunit[mukey].aggregate.component.percent_sum;
        out.mapunit[mukey].aggregate.chorizon[key].value = out.mapunit[mukey].aggregate.chorizon[key].weightedSum/out.mapunit[mukey].aggregate.chorizon[key].sumWeight;
      })

      // Aggregate component data up to map unit 
      Object.keys(component).forEach((key) => {
        if (!key.includes("key") && !skips.includes(key)) {
          if (parseFloat(component[key])) {
            out.mapunit[mukey].aggregate.component[key] = out.mapunit[mukey].aggregate.component[key] || {
              weightedSum: 0,
              sumWeight: 0
            };
            out.mapunit[mukey].aggregate.component[key].weightedSum += component[key]*component_percent;
            out.mapunit[mukey].aggregate.component[key].sumWeight = out.mapunit[mukey].aggregate.component.percent_sum;
            out.mapunit[mukey].aggregate.component[key].value = out.mapunit[mukey].aggregate.component[key].weightedSum/out.mapunit[mukey].aggregate.component[key].sumWeight;
          }
        }
      })

    })
  })

  fs.writeFileSync(`./soil-outputs.json`, JSON.stringify(out))
  return out;
}

function tableNameToKeyName(tableName: string) : string {
  let keys = {
    'SACATALOG': 'AREASYMBOL',
    'LEGEND': 'LKEY',
    'COMPONENT': 'COKEY',
    'MAPUNIT': 'MUKEY',
    'CHORIZON': 'CHKEY',
  }

  return keys[tableName.toUpperCase()] || `${tableName.toUpperCase()}KEY`;
}

// See https://sdmdataaccess.sc.egov.usda.gov/documents/TableRelationshipsDiagram.pdf
// and https://www.nrcs.usda.gov/Internet/FSE_DOCUMENTS/nrcs142p2_050900.pdf
let tableTree = {
  SACATALOG: {
    SAINTERP: {},
    FEATDESC: {}
  },
  LEGEND: {
    LAOVERLAP: {
      MUAOVERLAP: {}
    },
    LEGENDTEXT: {}
  },
  MAPUNIT: {
    MUCROPYLD: {},
    MUTEXT: {},
    MUAGGATT: {},
    MUAOVERLAP: {},
    COMPONENT: {
      COCANOPYCOVER: {},
      COCROP: {},
      COCROPYLD: {},
      CODIAGFEATURES: {},
      COECOCLASS: {},
      COEPLANTS: { 
        COSURFMORPHGC: {},
      },
      COEROSIONACC: {
        COSURFMORPHHPP: {},
      },
      COFORPROD: {
        COFORPRODO: {},
        COSURFMORPHMR: {},
      },
      COGEOMORDESC: {
        COSURFMORPHSS: {},
        COSURFMORPHGC: {},
        COSURFMORPHHPP: {},
        COSURFMORPHMR: {},
      },
      COHYDRICCRITERIA: {},
      COINTERP: {},
      COMONTH: {
        COSOILMOIST: {},
        COSOILTEMP: {}
      },
      COPMGRP: {
        COPM: {}
      },
      COPWINDBREAK: {},
      CORESTRICTIONS: {},
      COSURFFRAGS: {},
      COTAXFMMIN: {},
      COTAXMOISTCL: {},
      COTEXT: {},
      COTREESTOMNG: {},
      COTXFMOTHER1: {},
      CHORIZON: {
        CHAASHTO: {},
        CHCONSISTENCE: {},
        CHDESGNSUFFIX: {},
        CHFRAGS: {},
        CHPORES: {},
        CHSTRUCTGRP: {
          CHSTRUCT: {}
        },
        CHTEXT: {},
        CHTEXTUREGRP: {
          CHTEXTURE: {
            CHTEXTUREMOD: {},
          }
        },
        CHUNIFIED: {},
      }
    }
  },
  MUPOLYGON: {},
}

module.exports = {
  fromCounty,
  fromWkt,
  query,
  aggregate: _aggregate
}
