soisjs

A node module for accessing SSURGO soils data within the US

## Installation

```console
$ npm install soilsjs
```

## Usage

Retrieve SSURGO soils data using the SQL-based Soil Data Access REST API.

### Getting Started:
Return the primary data soil data tables for an area of interest in WKT format. Refer to other packages to translate from geojson or other formats.

```let wktStr = 'polygon((-86.7302676178553 40.4031488400723, -86.73027138053 71 40.4032666167283, -86.7303980022839 40.4035503896778, -86.7303774411828 40.4036807296437, -86.7303165534701 40.4037264832885, -86.7301845989508 40.4037311353392, -86.7299436537218 40.4036649894988, -86.7298337880099 40.403619241858, -86.7296261195992 40.4034443198906, -86.7295670365752 40.403375396507, -86.7295487963104 40.4033229296444, -86.7295891651778 40.4032971947975, -86.7296751509818 40.4031779428205, -86.7297926075345 40.4030645919529, -86.7299309407755 40.402974302328, -86.7300830258591 40.4029800998273, -86.7301991374799 40.40306039039, -86.7302676178553 40.4031488400723))';
let soils = await soilsjs.fromWkt(wktStr);
```
#### Output sample
```
{
  mapunit: { // SSURGO table names
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


                                                                           
The following URL can be used to test queries:                             
<https://sdmdataaccess.nrcs.usda.gov/Query.aspx>
