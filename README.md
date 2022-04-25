soilsjs

A node module for accessing SSURGO soils data within the US.
Retrieve USDA SSURGO soils data using the SQL-based Soil Data Access REST API.

## Installation

```console
$ npm install soilsjs
```

## Usage
Require the module:

```js
const soilsjs = require('soilsjs')
```

### fromWkt(wkt)
Return the primary soil data tables for an input geometry in Well Known Text (WKT) format. Refer to other packages for translation from geojson or other formats into WKT.
```
let wktStr = 'POLYGON ((-86.97704315185547 40.4821767494622, -86.97715044021605 40.48469011732992, -86.98195695877075 40.48469011732992, -86.98187112808228 40.4822093912065, -86.97704315185547 40.4821767494622))';
let soils = await soilsjs.fromWkt(wktStr);
```

### fromCounty:
Good for larger data queries. Generates a FIPS code-based AreaSymbol from county and state info.
```
let soils = await soilsjs.fromCounty("IN","Tippecanoe") // "abbreviate"
```

### Configure the data tables returned:
Specify the set of data tables to request. Add a configuration object as the last argument of each supported method (fromWkt, fromCounty). 
Refer to <https://sdmdataaccess.sc.egov.usda.gov/documents/TableRelationshipsDiagram.pdf> for the available data tables.
```
let config = [
  "mupolygon",
  "mapunit",
  "component",
  "chorizon",
  "comonth", //Add the COMONTH data table
];
let soils = await soilsjs.fromCounty("IN", "Tippecanoe", {config}) //optional last argument
```
Additional data tables will be returned as top level keys like the others. The default config is:
```
let config = [
  "mupolygon",
  "mapunit",
  "component",
  "chorizon",
];
```

### Custom Query
Send a custom query using the POST.Request web service.The following URL can be used to test queries:
<https://sdmdataaccess.nrcs.usda.gov/Query.aspx>
```
let soils = await soilsjs.query("SELECT * from MUAOVERLAP where mukey IN (163833)");
```

### Sample Output
There is a sample json output also included in the repo: <https://github.com/OpenATK/soilsjs/blob/master/sample-output.json>
In short, it will return a mostly flat object listing the table names at the top level. Under each table, each entry object is keyed under its primary key:
```
{
  mapunit: { // SSURGO table name
    164156: { // SURGO table primary identifier (mukey,i.e., map unit key)
      mukey: '164156',                                                          
      musym: 'Mu',                                                              
      muname: 'Milford silty clay loam, pothole',                               
      mukind: 'Consociation',                                                                                                    
      muacres: '2041',                                                                                                                
      component: { '21644674': '21644674' },  //references to other tables                                   
      ... //other properties
    },
    ... //other map units
  },
  component: {...},
  chorizon: {...},
  mupolygon: {
    257531365: {
      areasymbol: 'IN157',
      spatialversion: '4',
      musym: 'Mu',
      nationalmusym: '5htc',
      mukey: '164156',
      muareaacres: '1.71397298',
      mupolygongeo: 'POLYGON ((-86.7079490313471 40.3938857191248, -86.7077430949443 40.3939907363042, -86.7076493695392 40.3940044595455, -86.7075570619604 40.3939707481593, -86.7074666589326 40.3938950197864, -86.7073641480226 40.3935645584673, -86.7073735736689 40.3934100784965, -86.7074768105271 40.3933235055139, -86.707563394675 40.3932913169417, -86.7077659590546 40.3933035538252, -86.7079257165608 40.3933601748774, -86.7079989896765 40.3933476352372, -86.7080993258302 40.3932832721115, -86.7082792944798 40.3931027901632, -86.70834116046 40.3930678826812, -86.7084646348926 40.393036618021, -86.7086321861832 40.3930426856682, -86.7086949520158 40.3930831891091, -86.7087253251153 40.393124893485, -86.7087036557669 40.3933457432537, -86.7086007883763 40.393484368145, -86.7084654595839 40.3935972799925, -86.7081024705032 40.3937804210009, -86.7079490313471 40.3938857191248))',
      mupolygonproj: 'POLYGON ((-9652284.7338986769 4923346.8597040642, -9652261.809163183 4923362.2094328413, -9652251.3756988123 4923364.2152781589, -9652241.100066144 4923359.28788421, -9652231.0364471227 4923348.2191248015, -9652219.6249848213 4923299.9177330956, -9652220.6742429677 4923277.3384771263, -9652232.1665174514 4923264.6847329186, -9652241.8050207086 4923259.97996721, -9652264.3543842975 4923261.76854177, -9652282.13850854 4923270.0444255173, -9652290.295234466 4923268.2115977174, -9652301.4646040071 4923258.8041141881, -9652321.4986224361 4923232.4244464664, -9652328.3855118509 4923227.3222946338, -9652342.1306228135 4923222.7525876295, -9652360.782347165 4923223.6394472513, -9652367.76940769 4923229.5595143735, -9652371.15052566 4923235.6551163727, -9652368.73830483 4923267.9350603111, -9652357.2871592883 4923288.1968685538, -9652342.22242703 4923304.7004160313, -9652301.8146674037 4923331.4689353555, -9652284.7338986769 4923346.8597040642))',
      mupolygonkey: '257531365',
      PointAcreage: '0.00000000',
      LineAcreage: '0.00000000'
    }
  }
}
```

### aggregate
Aggregate horizon parameters up to components using a weighted average where the weight is the thickness of that horizon. Aggregate horizon and component data up to the map unit with weighted averages given the specified percentages of each component. Currently only parameters for which `parseFloat` succeed are aggregated up. It also returns the area proportion of each map unit polygon, map unit, and component. The output of the aggregate function is merge-friendly into the soils object output (shown below). Percents are 
```
let soils = await soilsjs.fromWkt(wktStr);
let aggregate = soilsjs.aggregate(soils, wktStr); //standalone object with the aggregation parameters
Object.assign(soils, aggregate).
//ALTERNATIVELY, do these three lines as:
let soils = await soilsjs.fromWkt(wktStr, {aggregate: true});

console.log(aggregate);
/*
{
  "mapunit": {
    "163904":{
      "mukey":"163904",
      "aggregate":{
        "area":{
          "sum":12873.932302290652,
          "percent":0.11356574520120395
        },
        "mupolygon":{  //per-polygon breakdown of area and percent of this polygon versus the input wkt geometry
          "257526563":{
            "mupolygonkey":"257526563",
            "area":12873.932302290652,
            "percent":0.11356574520120395,
            "geometry":{
              "type":"Feature",
              "properties":{},
              "geometry":{
                "type":"Polygon",
                "coordinates":[[[-86.98191051531971,40.48334778297007],[-86.98189579445415,40.48292231235579],[-86.9817526082302,40.4828531332318],[-86.9815955356254,40.4828006636962],[-86.981417262679,40.4828211110973],...]],
              }
            }
          }
        },
        "chorizon":{ // Horizon-level aggregations
          "desgnvert":{
            "weightedSum":1.0266666666666666,
            "sumWeight":1,
            "value":1.0266666666666666
          },
          ...// other horizon aggregations
        },
        "component":{ //Component-level aggregations
          "percent_sum":1,
          "comppct_r":{
            "weightedSum":100,
            "sumWeight":1,
            "value":100
          },
          ... // other component aggregations
        }
      }
    }
  },
  "component": {
    "aggregate": {
      ... // Per-component aggregations of horizon data
    }
  }
}
*/
```


For additional SDM Data Access API details, see <https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx>
