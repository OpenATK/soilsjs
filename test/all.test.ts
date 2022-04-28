import { expect } from 'chai';
let { fromWkt, fromCounty, query } = require('../dist/index');

let testWkt = `polygon((-86.97704315185547 40.4821767494622, -86.97715044021605 40.48469011732992, -86.98195695877075 40.48469011732992, -86.98187112808228 40.4822093912065, -86.97704315185547 40.4821767494622))`
let testPoint = `point(-86.97950005531311 40.48343343339606)`

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
    let result = await fromCounty('IN', 'Tippecanoe', {config});

    expect(result).to.have.all.keys(...['mapunit', 'component', 'chorizon', 'comonth', 'mupolygon'])
  });

  it(`Should retreive the data for a given polygon wkt`, async () => {
    let result = await fromWkt(testWkt,{config});

    expect(result).to.have.all.keys(...['mapunit', 'component', 'chorizon', 'comonth', 'mupolygon'])
  });

  it(`Should retreive the data for a given point wkt`, async () => {
    let result = await fromWkt(testPoint,{config});
    console.log(result);

    expect(result).to.have.all.keys(...['mapunit', 'component', 'chorizon', 'comonth', 'mupolygon'])
  });

  it('Should include only certain pieces when the default config is used', async () => {
    let result = await fromWkt(testWkt);
    expect(result).to.have.all.keys(...['mapunit', 'component', 'chorizon', 'mupolygon'])
  });

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
    let result = await fromWkt(testWkt, {config:conf});
    expect(result).to.have.all.keys(...conf);
    conf = [
      'chorizon',
    ]
    result = await fromWkt(testWkt, {config:conf});
    expect(result).to.not.have.keys(['mapunit']);
  });

  it('Aggregate should produce average areas as well as area-weighed average for each float-type attribute at the component and horizon level.', async () => {
    let agg = await fromWkt(testWkt, {aggregate: true});
    expect(agg).to.have.all.keys(...['mapunit', 'component', 'chorizon', 'mupolygon'])

    let mu : any = Object.values(agg.mapunit)[0];
    expect(mu).to.include.keys(['aggregate'])
    expect(mu.aggregate).to.include.keys(['area'])
    let sum = 0;
    let weighted = 0;
    for (let mukey in agg.mapunit) {
      expect(agg.mapunit[mukey]).to.include.keys(['aggregate'])
      sum += agg.mapunit[mukey].aggregate.area.percent;
      weighted += agg.mapunit[mukey].aggregate.area.percent * agg.mapunit[mukey].aggregate.component.percent_sum;
    }
    expect(sum).to.be.approximately(1, 0.001)

    // Unfortunately, the components don't all sum to 100% for each map unit,
    // so this check will be wrong. Instead, compute that the sum of individual
    // component percentages sums to the sum accounted for within each map unit.
    sum = 0;
    for (let cokey in agg.component) {
      if (agg.component[cokey].chorizon) {
        expect(agg.component[cokey]).to.include.keys(['aggregate'])
        expect(agg.component[cokey].aggregate.area.sum).to.not.equal(null)
        expect(agg.component[cokey].aggregate.area.percent).to.not.equal(null)
      }
      sum += agg.component[cokey].aggregate.area.percent;
    }
    expect(sum).to.be.approximately(weighted, 0.001)

    // Sum the area percent across the mupolygons
    sum = 0;
    Object.values(agg.mapunit).forEach((mapunit: any) => {
      Object.values(mapunit.aggregate.mupolygon).forEach((mupolygon: any) => {
        sum += mupolygon.area.percent;
      })
    })
    expect(sum).to.be.approximately(1, 0.001)
  })
});
