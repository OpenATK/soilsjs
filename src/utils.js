const fs = require('fs');
const Promise = require('bluebird');
const wicket = require('wicket');
const _ = require('lodash');
const gh = require('ngeohash');
const gju = require('geojson-utils');

const ghChars = "0123456789bcdefghjkmnpqrstuvwxyz";

async function polygonToGeohashes(obj) {
  if (_.isEmpty(obj.polygon)) return [];
  if (obj.polygon[0] !== obj.polygon[obj.polygon.length-1]) obj.polygon.push(obj.polygon[0]);
  //Get the four corners, convert to geohashes, and find the smallest common geohash of the bounding box
  let strings = [gh.encode(obj.bbox.north, obj.bbox.west, 9),
    gh.encode(obj.bbox.north, obj.bbox.east, 9),
    gh.encode(obj.bbox.south, obj.bbox.east, 9),
    gh.encode(obj.bbox.south, obj.bbox.west, 9)];
  let commonString = longestCommonPrefix(strings);
  console.log('starting from', commonString);
  let geohashes = await recursiveGeohashSearch(obj.polygon, commonString, [], 9)
  console.log(geohashes);
  let geoj = {
    'type': 'Polygon',
    'coordinates': []
  };
  geohashes.forEach((g) => {
    let ghBox = gh.decode_bbox(g);
    geoj.coordinates.push([
      [ghBox[1], ghBox[2]],
      [ghBox[3], ghBox[2]],
      [ghBox[3], ghBox[0]],
      [ghBox[1], ghBox[0]],
      [ghBox[1], ghBox[2]],
    ])
  })
  fs.writeFileSync('./geohashes.json', JSON.stringify(geoj), (err) => console.log)

  return geohashes;
}

function polygonsIntersect(polygon, geohashPolygon, geohash, ghBox, geohashes) {
  for (let i = 0; i < polygon.length-1; i++) {
    for (let j = 0; j < geohashPolygon.length-1; j++) {
      let lineA = {"type": "LineString", "coordinates": [polygon[i], polygon[i+1]]};
      let lineB = {"type": "LineString", "coordinates": [geohashPolygon[j], geohashPolygon[j+1]]};
      if (gju.lineStringsIntersect(lineA, lineB)) return true;
    }
  }
  return false;
}

function polygonInGeohash(polygon, geohashPolygon) {
  pt = {"type":"Point","coordinates": polygon[0]};
  poly = {"type":"Polygon","coordinates": [geohashPolygon]};
  return gju.pointInPolygon(pt, poly);
}

function geohashInPolygon() {
  let pt = {"type":"Point","coordinates": geohashPolygon[0]};
  let poly = {"type":"Polygon","coordinates": [polygon]};
  return gju.pointInPolygon(pt, poly)
}

async function recursiveGeohashSearch(polygon, geohash, geohashes, max) {
  //TODO: available geohashes could begin with e.g. geohash-3, but the greatest common prefix may only be a single character
  let ghBox = gh.decode_bbox(geohash);
  //create an array of vertices in the order [nw, ne, se, sw]
  let geohashPolygon = [
    [ghBox[1], ghBox[2]],
    [ghBox[3], ghBox[2]],
    [ghBox[3], ghBox[0]],
    [ghBox[1], ghBox[0]],
    [ghBox[1], ghBox[2]],
  ];

//1. If the polygon and geohash intersect, get a finer geohash.
   let intersects = polygonsIntersect(polygon, geohashPolygon, geohash, ghBox)
   if (intersects) {
     if (geohash.length === max) return; // Can't go any deeper, omit.
     for (var i = 0; i < ghChars.length; i++) {
       await recursiveGeohashSearch(polygon, g, geohashes, max);
     }
     return
   }

//2. If geohash is completely inside polygon, use it. Only one point
//   need be tested because no lines intersect in Step 1.
  if (geohashInPolygon(polygon, geohashPolygon)) return geohashes.push(geohash);

//3. If polygon is completely inside geohash, dig deeper. Only one point
//   need be tested because no lines intersect in Step 1 and geohash
//   isn't contained by the polygon in step 2.
  let pig = polygonInGeohash(polygon, geohashPolygon);
  if (pig) {
    if (geohash.length === max) return geohashes;
    for (var i = 0; i < ghChars.length; i++) {
      await recursiveGeohashSearch(polygon, geohash+ghChars[i], geohashes, max);
    }
    return;
  }

//4. Polygon and geohash are disjoint. 
  return;
}

// assume that any Geohash that makes it into this function
// is already known to intersect the query polygon
function geohashCovering(gh, max) {
  // Max precision; return geohash
  if (gh.precision >= max) return gh;

  // Geohash contained by polygon.
  if (geohashInPolygon(polygon, geohashPolygon)) return gh;

  // recurse into all children that intersect the
  // query polygon, but start with the child whose
  // centroid is closer to that of the target
  let leftChild = GeoHash(gh.binaryString + "0")
  let rightChild = GeoHash(gh.binaryString + "1")
  if (distance(polygon, leftChild) <= distance(polygon, rightChild)) {
    // the left child is closer, so start there
//      (if (polygon.intersects(leftChild) getGeohashPrefixes(leftChild)) else Nil) +
//      (if (polygon.intersects(rightChild) getGeohashPrefixes(rightChild)) else Nil)
  } else {
    // right right child is closer, so start there
//      (if (polygon.intersects(rightChild) getGeohashPrefixes(rightChild)) else Nil) +
//      (if (polygon.intersects(leftChild) getGeohashPrefixes(leftChild)) else Nil)
  }
}

//http://stackoverflow.com/questions/1916218/find-the-longest-common-starting-substring-in-a-set-of-strings
function longestCommonPrefix(strings) {
  let A = strings.concat().sort(), 
  a1= A[0], 
  a2= A[A.length-1], 
  L= a1.length, 
  i= 0;
  while(i < L && a1.charAt(i) === a2.charAt(i)) i++;
  return a1.substring(0, i);
}

async function decodeS2() {
  
}

function boundingBox(coords) {
  if (coords.length < 3) throw new Error('Not a polygon. Less than 3 links');
  let west = 200.0;
  let south = 200.0;
  let north = -200.0;
  let east = -200.0;
  coords.forEach((pt) => {
    if (pt[1] > north) north = pt[1];
    if (pt[1] < south) south = pt[1];
    if (pt[0] > east) east = pt[0];
    if (pt[0] < west) west = pt[0];
  })
  return {north,south,east,west};
}

function contains(polygons, pt) {
  let keys = Object.keys(polygons);
  for (var k = 0; k < keys.length; k++) {
    let mukey = keys[k];
    let polys = polygons[mukey].polygons;
    for (var p = 0; p < polys.length; p++) {
      let poly = polys[p];
      /* save this in case we want to check points values
      polys[p].rings.forEach((r) => {
        console.log(r.points.toArray());
        console.log('POINT IS: ', pt);
      })  
      */
      if (gju.pointInPolygon(pt, poly)) return mukey
    }
  }
}


function rasterize(filename, polygons) {
  // Read in the DEM
  let ds = gdal.open(filename);

  // Duplicate the DEM to which the soils data will be written
  let driver = gdal.drivers.get('GTiff');
  let copy = driver.createCopy("soils.tif", ds);
  let band = copy.bands.get(1);
  let target = gdal.SpatialReference.fromEPSG(4326);
  let src = copy.srs;
  let trans = new gdal.CoordinateTransformation(src, target);
  let gtran = copy.geoTransform;

  console.log(band.size.x, band.size.y);
  let xs = new Array(band.size.x);
  //return Promise.map(xs, (it, x) => {
  for (var x = 0; x < band.size.x; x++) {
    let ys = new Array(band.size.y);
    //return Promise.map(ys, (item, y) => {
    for (var y = 0; y < band.size.y; y++) {
      // Get the point in projected (world) coordinates
      var pt = pixelToWorld(gtran, x, y);
      var tpt = trans.transformPoint(pt.x, pt.y)

      let gpt = {
        "type": "Point",
        "coordinates": [tpt.x, tpt.y]
      }
        
      let val = contains(polygons, gpt) || '0';
      console.log('val', val, x, y, (100* (x/band.size.x)));
      band.pixels.set(x, y, parseInt(val));
//      return
    }
  }
}

function pixelToWorld(gtran, x, y) {
  return {
    x: (gtran[1]*x) + (gtran[2]*y) + gtran[0],
    y: (gtran[4]) + (gtran[5]*x) + gtran[3]
  }
}

module.exports = {
  recursiveGeohashSearch,
  polygonToGeohashes,
  boundingBox,
  rasterize,
  pixelToWorld,
  longestCommonPrefix,
}
