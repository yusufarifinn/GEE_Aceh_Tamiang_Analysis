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
