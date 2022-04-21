import { expect } from 'chai';
//import { setTimeout } from 'timers/promises';
//import { connect, OADAClient } from '@oada/client';
let { fromWkt, fromCounty, query } = require('../dist/index');

let testWkt = `polygon((-86.7302676178553 40.4031488400723, -86.7302713805371 40.4032666167283, -86.7303980022839 40.4035503896778, -86.7303774411828 40.4036807296437, -86.7303165534701 40.4037264832885, -86.7301845989508 40.4037311353392, -86.7299436537218 40.4036649894988, -86.7298337880099 40.403619241858, -86.7296261195992 40.4034443198906, -86.7295670365752 40.403375396507, -86.7295487963104 40.4033229296444, -86.7295891651778 40.4032971947975, -86.7296751509818 40.4031779428205, -86.7297926075345 40.4030645919529, -86.7299309407755 40.402974302328, -86.7300830258591 40.4029800998273, -86.7301991374799 40.40306039039, -86.7302676178553 40.4031488400723))`

let config = [
  'mupolygon',
  'mapunit',
  'component',
  'comonth',
  'chorizon'
];

describe('Overall functional tests: all.test.js', function() {
  this.timeout(120_000);

  before(async () => {
  });

  after(async () => {
  });

  it('Should get map unit data', async () => {
    let result = await fromCounty('IN','Tippecanoe', config);

    expect(result).to.have.all.keys(...['mapunit', 'component', 'chorizon', 'comonth', 'mupolygon'])
  });

  it(`Should retreive the data for a given wkt`, async () => {
    console.log({testWkt})
    let result = await fromWkt(testWkt, config);
    console.log(result);

    expect(result).to.have.all.keys(...['mapunit', 'component', 'chorizon', 'comonth', 'mupolygon'])
  });

  it('Should include only certain pieces when the default config is used', async () => {
    let result = await fromWkt(testWkt);
    expect(result).to.have.all.keys(...['mapunit', 'component', 'chorizon', 'mupolygon'])
  });

  /*
  it('Should prune undesired pieces when given custom config', async () => {
    expect().to.have.own.property('')
  });
 */

  it('Should return the response of a query', async () => {
    let q = `SELECT * from MUAOVERLAP where mukey IN (163833)`
    let result = await query(q);
    expect(result).to.have.all.keys(...['data', 'status', 'headers', 'config', 'request', 'statusText']);
    expect(result.data).to.have.all.keys(...['Table']);
//    expect(result.data).to.have.all.keys(...['areaovacres','lareaovkey','mukey','muareaovkey']);
  });

  it('Should handle configurable set of data tables', async () => {
    let conf = [
      'mapunit',
      'mupolygon',
      'component',
      'comonth',
      'chorizon',
    ]
    let result = await fromWkt(testWkt, conf);
    expect(result).to.have.all.keys(...conf);
    conf = [
      'chorizon',
    ]
    result = await fromWkt(testWkt, conf);
    console.log(result);
    expect(result).to.not.have.keys(['mapunit']);

  });

});
