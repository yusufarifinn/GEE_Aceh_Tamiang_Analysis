
function maskSCL(img){
  var scl = img.select('SCL');
  var mask = scl
    .neq(0)
    .and(scl.neq(1))
    .and(scl.neq(2))
    .and(scl.neq(3))
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10))
    .and(scl.neq(11));
  return img.updateMask(mask);
}

function getComposite(startDate, endDate) {
  var col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(table)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 90))
    .map(maskSCL)
    .select(['B2','B3','B4','B8','B11']);

  var comp = col.median().clip(table).toFloat();

  var ndvi  = comp.normalizedDifference(['B8','B4']).rename('NDVI');
  var mndwi = comp.normalizedDifference(['B3','B11']).rename('MNDWI');
  var ndbi  = comp.normalizedDifference(['B11','B8']).rename('NDBI');
  return comp.addBands([ndvi, mndwi, ndbi]);
}

var img2019 = getComposite('2019-06-01', '2019-12-31');
var img2022 = getComposite('2022-06-01', '2022-12-31');
var img2025 = getComposite('2025-06-01', '2025-12-31');

var vis_param = {
  bands : ['B4','B3','B2'],
  min : 200,
  max : 2800
};

Map.centerObject(table,10);
// Map.addLayer (img2019, vis_param, 'RGB tahun 2019');
// Map.addLayer (img2022, vis_param, 'RGB tahun 2022');
Map.addLayer (img2025, vis_param, 'RGB tahun 2025');

var bands = [
  'B2','B3','B4','B8','B11',
  'NDVI','MNDWI','NDBI'
];

var trainingSamples = Hutan
.merge(Perkebunan)
.merge(OpenLand)
.merge(Water)
.merge(BuiltUp);

var training = img2025.select(bands).sampleRegions({
  collection: trainingSamples, // FeatureCollection multi-kelas
  properties: ['class'],
  scale: 10
});

// var classifier = ee.Classifier.smileRandomForest(300).train({
//   features: training,
//   classProperty: 'class',
//   inputProperties: bands
// });

var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 120,
  minLeafPopulation: 5,
  bagFraction: 0.7,
  seed: 42
}).train({
  features: training,
  classProperty: 'class',
  inputProperties: bands
});

var landuse2019 = img2019.select(bands).classify(classifier).toInt8();
var landuse2022 = img2022.select(bands).classify(classifier).toInt8();
var landuse2025 = img2025.select(bands).classify(classifier).toInt8();

function hitungLuasKelas(image, kode, aoi, scale) {
  var mask = image.eq(kode);
  var pixelArea = ee.Image.pixelArea()
    .rename('luas_m2');
  var luas = pixelArea
    .updateMask(mask)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi.geometry(),
      scale: scale,
      maxPixels: 1e13,
      tileScale: 4
    });
  var luas_m2 = ee.Number(luas.get('luas_m2'));

  return ee.Feature(null, {
    class: kode,
    luas_m2: luas_m2,
    luas_ha: luas_m2.divide(10000),
    luas_km2: luas_m2.divide(1000000)
  });
}

// Hitung luasan area setiap kelas pertahun
var luasHutan = hitungLuasKelas(landuse2019, 1, table, 10);
var luasPerkebunan = hitungLuasKelas(landuse2019, 2, table, 10);
var luasOpenLand = hitungLuasKelas(landuse2019, 3, table, 10);
var luasWater = hitungLuasKelas(landuse2019, 4, table, 10);
var luasBuiltUp = hitungLuasKelas(landuse2019, 5, table, 10);

var hasilLuas = ee.FeatureCollection([
  luasHutan,
  luasPerkebunan,
  luasOpenLand,
  luasWater,
  luasBuiltUp
]);
print('Luas setiap kelas 2019:', hasilLuas);

Map.addLayer(landuse2025, {
  min: 1, max: 5,
  palette: ['green','yellow','khaki','darkblue','red']
}, 'Land use 2025');

Map.addLayer(landuse2022, {
  min: 1, max: 5,
  palette: ['green','yellow','khaki','darkblue','red']
}, 'Land use 2022');

Map.addLayer(landuse2019, {
  min: 1, max: 5,
  palette: ['green','yellow','khaki','darkblue','red']
}, 'Land use 2019');

// var change_19_22 = lulc2019.add(lulc2022.multiply(10));
// var change_22_25 = lulc2022.add(lulc2025.multiply(10));
// var change_19_25 = lulc2019.add(lulc2025.multiply(10));
