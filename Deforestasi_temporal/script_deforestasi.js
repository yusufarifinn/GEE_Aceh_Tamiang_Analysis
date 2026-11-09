
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

var forest2019 = landuse2019.eq(1);
var forest2022 = landuse2022.eq(1);
var forest2025 = landuse2025.eq(1);

Map.addLayer(forest2019, {
  min: 0, max: 1,
  palette: ['white','darkgreen']
}, 'Hutan 2019');
Map.addLayer(forest2022, {
  min: 0, max: 1,
  palette: ['white','yellow']
}, 'Hutan 2022');
Map.addLayer(forest2025, {
  min: 0, max: 1,
  palette: ['white','green']
}, 'Hutan 2025');

//Deforestasi antar periode
var defor_19_22 = forest2019.and(forest2022.not()).selfMask();
var defor_22_25 = forest2022.and(forest2025.not()).selfMask();
var defor_19_25 = forest2019.and(forest2025.not()).selfMask();

// MENGHITUNG LUASAN AREA DEFORESTASI ANTARTAHUN
var pixelArea = ee.Image.pixelArea()
  .divide(10000)
  .rename('luas_ha');
  
var areadefor_19_22 = pixelArea.updateMask(defor_19_22);
var areadefor_22_25 = pixelArea.updateMask(defor_22_25);
var areadefor_19_25 = pixelArea.updateMask(defor_19_25);

var totaldefor_19_22 = areadefor_19_22.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table.geometry(),
  scale: 10,
  maxPixels: 1e13,
  tileScale: 4 });
var totaldefor_22_25 = areadefor_22_25.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table.geometry(),
  scale: 10,
  maxPixels: 1e13,
  tileScale: 4 });
var totaldefor_19_25 = areadefor_19_25.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table.geometry(),
  scale: 10,
  maxPixels: 1e13,
  tileScale: 4 });

print('Total Luas Deforestasi 2019-2022 (ha):', totaldefor_19_22 );
print('Total Luas Deforestasi 2022-2025 (ha):', totaldefor_22_25 );
print('Total Luas Deforestasi 2019-2025 (ha):', totaldefor_19_25 );