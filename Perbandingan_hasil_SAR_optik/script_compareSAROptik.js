//waktu terjadi banjir : 25-29 november 2025

var before_flood = imageCollection
 .filterBounds(table)
 .filterDate('2025-11-18', '2025-11-24')
 .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
 .filter(ee.Filter.eq('instrumentMode', 'IW'))
 .select(['VV','VH']);

var before_flood1 = before_flood.median().clip(table);

print('Jumlah citra pra-banjir:', before_flood.aggregate_count('system:index'));
print('jumlah citra sebelum banjir:', before_flood.size());
print('crs:', before_flood.projection());

var during_flood = imageCollection
.filterBounds(table)
.filterDate('2025-11-25', '2025-11-29')
.filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
.filter(ee.Filter.eq('instrumentMode', 'IW'))
.select(['VV','VH']);

print('Jumlah citra selama-banjir:', during_flood.aggregate_count('system:index'));
print('jumlah citra ketika banjir:', during_flood.size());

var during_flood1 = during_flood.median().clip(table);

//konversi dB ke linear scale untuk menghitung nilai ratio_vv
var before_lin = ee.Image(10).pow(before_flood1.divide(10));
var during_lin = ee.Image(10).pow(during_flood1.divide(10));

var ratioVV = during_lin.select('VV').divide(before_lin.select('VV')).rename('ratioVV');
var ratioVH = during_lin.select('VH').divide(before_lin.select('VH')).rename('ratioVH');

//menghitung nilai VV_dB_during
var VV_dB = during_flood1.select('VV');

//menghitung nilai VH_dB_during
var VH_dB = during_flood1.select('VH');

//klasifikasi atau threshold nilai banjir
var banjir = ratioVV.lt(0.7)
 .and(VV_dB.lt(-15))
 .and(VH_dB.lt(-20))
 .selfMask();

Map.centerObject(table, 10);
Map.addLayer(ratioVV, {min:0.3, max:1.2, palette:['blue','white','red']}, 'Ratio VV');
Map.addLayer(VV_dB, {min:-25, max:-5, palette:['blue','cyan','green']}, 'VV dB'); 
Map.addLayer(VH_dB, {min:-30, max:-10, palette:['black','purple','yellow']}, 'VH dB');
Map.addLayer(banjir, {palette:'blue'}, 'Flood Area metode SAR');

var pixelArea = ee.Image.pixelArea()
  .divide(10000)
  .rename('luas_ha');
  
var areaBanjir = pixelArea.updateMask(banjir);

var totalBanjirSAR = areaBanjir.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table.geometry(),
  scale: 10,
  maxPixels: 1e13,
  tileScale: 4 });

print('Total Luas Banjir Metode SAR (ha):', totalBanjirSAR );

var s2 = imageCollection2
 .filterBounds(table)
 .filterDate('2025-11-01','2025-12-20')
 .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 100));
 
function maskscl(img){
  var scl = img.select('SCL');
  var mask = scl
   .neq(3)
   .and(scl.neq(7))
   .and(scl.neq(8))
   .and(scl.neq(9))
   .and(scl.neq(10))
   .and(scl.neq(2));
  return img.updateMask(mask);
}

var s2_composite = s2.map(maskscl)
// .select(['B4','B3','B2'])
 .median()
 .clip(table);

print('jumllah citra:', s2.size());
Map.addLayer(s2_composite, {min : 200, max : 2800, bands : ['B4', 'B3','B2']}, "RGB True Color ACEH TAMIANG ketika banjir BULAN 11 dan 12");

var bandMap ={
  BLUE : s2_composite.select('B2'),
  GREEN : s2_composite.select('B3'),
  RED : s2_composite.select('B4'),
  NIR : s2_composite.select('B8'),
  SWIR1 : s2_composite.select('B11'),
};

//Menghitung indeks vegetasi menggunakan ekspresi atau persamaan
var ndvi = s2_composite.expression('(NIR - RED) / (NIR + RED)', bandMap).rename('NDVI');
var evi = s2_composite.expression('2.5*(NIR - RED)/(NIR + 6*RED - 7.5*BLUE + 1)', bandMap).rename('EVI');
var savi = s2_composite.expression('((NIR - RED)*(1 + 0.5)) / (NIR + RED + 0.5)', bandMap).rename('SAVI');
var ndwi = s2_composite.expression('(GREEN - NIR)/(GREEN + NIR)', bandMap).rename('NDWI');
var mndwi = s2_composite.expression('(GREEN - SWIR1)/(GREEN + SWIR1)', bandMap).rename('MNDWI');

//Threshold nilai banjir menggunakan citra optik
var banjir_optik = (ndwi.gte(0.1)
  .or(mndwi.gt(0.01)))
  .and(ndvi.lt(0))
  .selfMask();

Map.addLayer(banjir_optik, {min:0, max:1, palette :['white', 'cyan']}, 'BANJIR OPTIK');

// menghitung luasan banjir optik
var areaBanjir = pixelArea.updateMask(banjir_optik);
var totalBanjirOPTIK = areaBanjir.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: table.geometry(),
  scale: 10,
  maxPixels: 1e13,
  tileScale: 4 });

print('Total Luas Banjir Metode OPTIK (ha):', totalBanjirOPTIK );

//Identifikasi sungai
var s3 = imageCollection2
 .filterBounds(table)
 .filterDate('2025-09-01','2025-11-20')
 .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 100));
 
function maskscl(img){
  var scl = img.select('SCL');
  var mask = scl
   .neq(3)
   .and(scl.neq(7))
   .and(scl.neq(8))
   .and(scl.neq(9))
   .and(scl.neq(10))
   .and(scl.neq(2));
  return img.updateMask(mask);
}

var s3_composite = s3.map(maskscl)
 .select(['B4','B3','B2','B8','B11'])
 .median()
 .clip(table);

print('jumllah citra:', s2.size());
// Map.addLayer(s2_composite, {min : 200, max : 2800, bands : ['B4', 'B3','B2']}, "RGB ACEH TAMIANG ketika banjir BULAN 11 dan 12");

//melakukan indeks vegetasi
var bandMap ={
  BLUE : s3_composite.select('B2'),
  GREEN : s3_composite.select('B3'),
  RED : s3_composite.select('B4'),
  NIR : s3_composite.select('B8'),
  SWIR1 : s3_composite.select('B11'),
};

//HITUNG NILAI INDEKS VEGETASI 
var ndvi = s3_composite.expression('(NIR - RED) / (NIR + RED)', bandMap).rename('NDVI');
var evi = s3_composite.expression('2.5*(NIR - RED)/(NIR + 6*RED - 7.5*BLUE + 1)', bandMap).rename('EVI');
var savi = s3_composite.expression('((NIR - RED)*(1 + 0.5)) / (NIR + RED + 0.5)', bandMap).rename('SAVI');
var ndwi = s3_composite.expression('(GREEN - NIR)/(GREEN + NIR)', bandMap).rename('NDWI');
var mndwi = s3_composite.expression('(GREEN - SWIR1)/(GREEN + SWIR1)', bandMap).rename('MNDWI');


var river = (mndwi.gt(0.2).or(ndwi.gt(0.1))).and(ndvi.lt(0)).and(savi.lt(0)).selfMask();
Map.addLayer(river, {min:0, max:1, palette :['white', 'darkblue']}, 'SUNGAI SAJA');

//Override sungai dan banjir
var final = banjir_optik
 .where(river, 2);
// .where(banjir, 3);
 
Map.addLayer(final, {min:1, max:2, palette :['cyan', 'darkblue']}, 'Banjir optik dan sungai saja');
