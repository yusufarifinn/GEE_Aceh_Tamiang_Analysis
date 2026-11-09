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

var aceh_tamiang = imageCollection
 .filterDate('2025-08-01','2025-11-01' )
 .filterBounds(aoi)
 .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 80))
 .map(maskSCL);
 
print('jumlah citra yang digunakan:', aceh_tamiang.size());

var s2 = aceh_tamiang
  .median()
  .clip(aoi);

var vis_params = {
  bands : ['B4','B3','B2'],
  min : 200,
  max : 2800 };
Map.centerObject(aoi, 10);
Map.addLayer (s2, vis_params, 'Aceh Tamiang True Color');

var bandMap = {
  BLUE : s2.select('B2'),
  GREEN : s2.select('B3'),
  RED : s2.select('B4'),
  NIR : s2.select('B8'),
  SWIR1 : s2.select('B11'),
  SWIR2 : s2.select('B12'),
};

// MENGHITUNG NILAI INDEK VEGETASI MENGGUNAKAN EKSPRESI/PERSAMAAN

var ndvi = s2.expression('(NIR - RED)/(NIR + RED)', bandMap).rename('NDVI');
var evi = s2.expression('2.5*(NIR - RED)/(NIR + 6*RED - 7.5*BLUE + 1)', bandMap).rename('EVI');
var savi = s2.expression('((NIR - RED)*(1+0.5))/(NIR + RED+0.5)', bandMap).rename('SAVI');
var ndwi = s2.expression('(GREEN - NIR)/(GREEN + NIR)', bandMap).rename('NDWI');
var mndwi = s2.expression('(GREEN - SWIR1)/(GREEN + SWIR1)', bandMap).rename('MNDWI');
var ndbi = s2.expression('(SWIR1- NIR)/(SWIR1 + NIR)', bandMap).rename('NDBI');

// Map.addLayer (ndvi, {min : 0, max : 1, palette : ['pink', 'darkgreen']}, 'Aceh Tamiang NDVI');
// Map.addLayer (evi, {min : 0, max : 1, palette : [ 'green', 'darkgreen']}, 'Aceh Tamiang EVI');
// Map.addLayer (savi, {min : 0, max : 1, palette : ['brown', 'yellow']}, 'Aceh Tamiang SAVI');
// Map.addLayer (ndwi, {min : 0, max : 1, palette : ['lightblue', 'darkblue']}, 'Aceh Tamiang NDWI');
// Map.addLayer (mndwi, {min : 0, max : 1, palette : ['white', 'blue']}, 'Aceh Tamiang MNDWI');
// Map.addLayer (ndbi, {min : 0, max : 1, palette : ['white', 'black']}, 'Aceh Tamiang NDBI');


var vegetasi = ndvi.gte(0.1).and(evi.gte(0.1));
Map.addLayer (vegetasi, {min : 0, max : 1, palette : ['lightyellow', 'darkgreen']}, 'Aceh Tamiang NDVI + EVI');

var training = sawit.merge(vegnosawit);

var label = 'kelas';
var bands = ['B3', 'B4', 'B8'];
var input = s2.select(bands);

var trainingSubset = training.randomColumn('rand')
  .filter(ee.Filter.lt('rand', 0.55));

var trainImage = input.sampleRegions({
  collection : trainingSubset,
  properties : [label],
  scale : 10 });

var trainingData = trainImage.randomColumn();
var trainSet = trainingData.filter(ee.Filter.lt('random', 0.7));
var testSet = trainingData.filter(ee.Filter.gte('random', 0.7));

var classifier = ee.Classifier.smileRandomForest(200)
.train({
  features : trainSet,
  classProperty : label,
  inputProperties : bands
});
 
var classified = input.classify(classifier);  // hasil machine learning

var kernel = ee.Kernel.square({  ///metode 1 eliminasi salt and paper noise
  radius: 1,  // 1 piksel → 3x3
  units: 'pixels',
  normalize: false
});

var classified_pure = classified // hanya sawit dan nonsawit, salt pepper eliminasi
  .reduceNeighborhood({
    reducer: ee.Reducer.mode(),
    kernel: kernel
  });
Map.addLayer(classified_pure,
  {
    min: 1,
    max: 2,
    palette: ['red', 'green']
  },
  'Klasifikasi Sawit dan Nonsawit');
  
var pixelArea = ee.Image.pixelArea()
  .divide(10000)
  .rename('luas_ha');

var areaImage = pixelArea.addBands(classified_pure);

var areaResult = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1,
    groupName: 'kelas'
  }),
  geometry: aoi.geometry(),
  scale: 10,
  maxPixels: 1e13,
  tileScale: 4
});

print('Hasil Perhitungan Luas:', areaResult);

var waterMask = ndwi.gt(0.2).and(ndvi.lt(0)); // identifikasi sungai
var cleaned = classified.updateMask(waterMask.not()); // sungai hilang di hasil ML
var override_river = classified
 .where(ndwi.gt(0.2).and(ndvi.lt(0)), 3); //ovveride atau menimpa sungai ke hasil ML
 
var kernel = ee.Kernel.square({  
  radius: 1,  // 1 piksel → 3x3
  units: 'pixels',
  normalize: false
});
var classified_smooth = override_river 
  .reduceNeighborhood({
    reducer: ee.Reducer.mode(),
    kernel: kernel
  });

Map.addLayer (classified_smooth, {min : 1, max : 3, palette :['darkgreen', 'khaki', 'blue']}, 'hasil klasifikasi sawit v non-sawit override sungai');

// Export.image.toDrive({
  // image: classified_smooth,
  //description: 'classified_sawit_III_salt_pepper',
  //folder: 'GEE_Export',       // nama folder di Drive
  //fileNamePrefix: 'smooth_sawit_class_III_salt_pepper', 
  //scale: 10,                  // resolusi Sentinel-2
  //region: aoi.geometry(),   // AOI
  //crs: 'EPSG:4326',           // CRS kompatibel QGIS
  //maxPixels: 1e13             // agar area luas bisa diexport
//});
