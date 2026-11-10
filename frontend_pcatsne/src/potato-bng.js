import proj4 from 'proj4';

// Matches the installed Python PROJ operation (OSGB36 seven-parameter Helmert).
// Polygon operations and measurements stay in EPSG:27700; this is display only.
export const BNG_DEFINITION='+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs';
const displayProjection=proj4(BNG_DEFINITION,'EPSG:4326');
export const toWgs84=point=>displayProjection.forward(point);
export const toBng=point=>displayProjection.inverse(point);
