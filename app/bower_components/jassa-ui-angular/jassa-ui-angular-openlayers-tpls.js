/*
 * jassa-ui-angular
 * https://github.com/GeoKnow/Jassa-UI-Angular

 * Version: 0.0.4-SNAPSHOT - 2014-08-06
 * License: MIT
 */
angular.module("ui.jassa.openlayers", ["ui.jassa.openlayers.tpls", "ui.jassa.openlayers.jassa-map-ol","ui.jassa.openlayers.jassa-map-ol-a"]);
angular.module("ui.jassa.openlayers.tpls", []);
//TODO Move to some better place
jassa.setOlMapCenter = function(map, config) {
    var zoom = config.zoom;

    var center = config.center;
    var olCenter = null;
    if(center && center.lon != null && center.lat != null) {
        var lonlat = new OpenLayers.LonLat(center.lon, center.lat);
        olCenter = lonlat.clone().transform(map.displayProjection, map.projection);
    }

    if(olCenter != null) {
        map.setCenter(olCenter, zoom);
    }
    else if(zoom != null) {
        map.setZoom(zoom);
    }
};



angular.module('ui.jassa.openlayers.jassa-map-ol', [])

.controller('JassaMapOlCtrl', ['$scope', '$q', function($scope, $q) {

    $scope.loadingSources = [];
    
    $scope.items = [];

    
    /**
     * Checks whether the item is a box or a generic object
     */
    var addItem = function(item) {
        var mapWrapper = $scope.map.widget;

        if(item.zoomClusterBounds) {
            mapWrapper.addBox(item.id, item.zoomClusterBounds);
        }
        else {
            var wktNode = item.wkt;
            var wkt = wktNode.getLiteralLexicalForm();

            mapWrapper.addWkt(item.id, wkt, item);// {fillColor: markerFillColor, strokeColor: markerStrokeColor});
        }
    };
    
    $scope.$watchCollection('items', function(after, before) {
        var mapWrapper = $scope.map.widget;
        mapWrapper.clearItems();

        _($scope.items).each(function(item) {
            addItem(item);
        });
    });
    
    
    //$scope.boxes = [];
    var fetchDataFromSourceCore = function(dataSource, bounds) {
        
        var p = dataSource.fetchData(bounds);
        
        var result = p.pipe(function(items) {

            items = _(items).compact();

            // Commented out because this is the application's decision 
            // Add the dataSource as the config
//            _(items).each(function(item) {
//                item.config = dataSource;
//            });

            return items;
        });
        
        return result;
    };
    
    var fetchDataFromSource = function(dataSourceId, dataSource, bounds) {
        // Check if we are already loading from this data source
        var idToState = _($scope.loadingSources).indexBy('id');
        
        var state = idToState[dataSourceId];
        
        // If there is a prior state, cancel it
        if(state) {
            if(state.promise.abort) {
                state.promise.abort();
            }
        } else {
            state = {
                id: dataSourceId,
                requestId: 0
            };

            idToState[dataSourceId] = state;
            $scope.loadingSources.push(state);
        }
        
        var requestId = ++state.requestId;
        
        var promise = fetchDataFromSourceCore(dataSource, bounds);
        
        var result = promise.pipe(function(items) {
            if(idToState[dataSourceId].requestId != requestId) {
                return;
            }

            items = _(items).compact(true);
            
            
            jassa.util.ArrayUtils.removeByGrep($scope.loadingSources, function(item) {
                return item.id === dataSourceId;
            });
            
            jassa.util.ArrayUtils.addAll($scope.items, items);

            if(!$scope.$$phase && !$scope.$root.$$phase) {
                $scope.$apply();
            }
            
            return items;
        });

        
        state.promise = result;
        
        return result;
    };
    
        
    var fetchData = function(dataSources, bounds, progressionCallback) {

        var promises = [];
        //for(var i = 0; i < dataSources.length; ++i) {
        _(dataSources).each(function(dataSource, i) {
            var promise = fetchDataFromSource('' + i, dataSource, bounds);
            promises.push(promise);
        });
        
        //var promises = _(dataSources).map(function(dataSource) {
        //    fetchDataFromSource
        //});
        
        var result = jQuery.when.apply(window, promises).pipe(function() {
            var r = _(arguments).flatten(true);
            return r;
        });

        return result;
    };

    var refresh = function() {
        
        jassa.util.ArrayUtils.clear($scope.items);

        var dataSources = $scope.sources;
        var bounds = jassa.geo.openlayers.MapUtils.getExtent($scope.map);

        var promise = fetchData(dataSources, bounds);

        // Nothing to to with the promise as the scope has already been updated
//        jassa.sponate.angular.bridgePromise(promise, $q.defer(), $scope, function(items) {
//            $scope.items = items;
//        });
    };
    
    
    // Make Jassa's ObjectUtils known to the scope - features the hashCode utility function
    $scope.ObjectUtils = jassa.util.ObjectUtils;
    
    $scope.$watch('config', function(config, oldConfig) {
        if(_(config).isEqual(oldConfig)) {
            return;
        }
        
        jassa.setOlMapCenter($scope.map, config);
    }, true);
    

    $scope.$watch('[map.center, map.zoom]', function() {
        //console.log('Map refresh: ' + jassa.util.ObjectUtils.hashCode($scope.config));
        refresh();
    }, true);
    
    
//    $scope.$watch('sources', function() {
//        refresh();
//    });
    $scope.$watchCollection('sources', function() {
        refresh();
    });

    
}])

//http://jsfiddle.net/A2G3D/1/
.directive('jassaMapOl', ['$compile', function($compile) {
    return {
        restrict: 'EA',
        replace: true,
        template: '<div></div>',
        controller: 'JassaMapOlCtrl',
        scope: {
            config: '=',
            sources: '=',
            onSelect: '&select',
            onUnselect: '&unselect'
        },
        link: function (scope, element, attrs) {
            
            var $el = jQuery(element).ssbMap();
            var widget = $el.data('custom-ssbMap');

            var map = widget.map;
            map.widget = widget;
            
            scope.map = map;

            jassa.setOlMapCenter(scope.map, scope.config);

            // Status Div
            //<ul><li ng-repeat="item in loadingSources">{{item.id}}</li></ul>
            var statusDivHtml = '<span ng-show="loadingSources.length > 0" class="label label-primary" style="position: absolute; right: 10px; bottom: 25px; z-index: 1000;">Waiting for data from <span class="badge">{{loadingSources.length}}</span> sources... </span>';
            
            var $elStatus = $compile(statusDivHtml)(scope);
            element.append($elStatus);
            
            /*
            var $;
            if (!$) {$ = angular.element; }
            var $statusDiv = $('<div>');
            $statusDiv.css({
                position: 'absolute',
                right: 10,
                bottom: 10,
                'z-index': 1000
            });
            var $statusContent = $('<span>YAAAY</span>');
            
            $statusDiv.append($statusContent);
            
            element.append($statusDiv);
*/
            
            // Status Div
            
            var syncModel = function(event) {
                var tmp = scope.map.getCenter();
                var center = tmp.transform(scope.map.projection, scope.map.displayProjection);
                
                //console.log('syncModel', center);

                scope.config.center = {lon: center.lon, lat: center.lat};
                scope.config.zoom = scope.map.getZoom();
                if(!scope.$root.$$phase) {
                    scope.$apply();
                }
            };

            
            $el.on('ssbmapfeatureselect', function(ev, data) {
                scope.onSelect({data: data});
            });

            $el.on('ssbmapfeatureunselect', function(ev, data) {
                scope.onUnselect({data: data});
            });
                    
            
            map.events.register('moveend', this, syncModel);
            map.events.register('zoomend', this, syncModel);
        }
            
    };
}])

;


/**
 * Copyright (C) 2011, MOLE research group at AKSW,
 * University of Leipzig
 *
 * SpatialSemanticBrowsingWidgets is free software; you can redistribute
 * it and/or modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * SpatialSemanticBrowsingWidgets is distributed in the hope that it will
 * be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
 * of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
(function($) {
    
    
$.widget('custom.ssbMap', {

    // TODO: Add _init method for backward compatibility

    
    _create: function() {
        var self = this;
        
        this.wktParser = new OpenLayers.Format.WKT();
        
        var opts = this.options;
        //this.options.event += '.ssbinstances'; // namespace event
        
        this.idToBox = {};
        
        this.domElement = this.element.get(0);


        this.options.zoomLabel = 'Click to\nzoom in\non the\ndata';

        
        //this.nodeToPos = this.options.nodeToPos;
        this.idToFeature = {}; //this.options.idToFeature;
        
//        this.nodeToLabel = {}; //this.options.nodeToLabel;
//        this.wayToFeature = {}; //this.options.wayToFeature;
//        
//        this.nodeToTypes = {}; //this.options.nodeToTypes;
//        this.schemaIcons = {}; //this.options.schemaIcons;
        
        
        //console.log(this.nodeToPos);
        //this.mapWidget = new MapWidget(this);
        //this.mapWidget._load();
        //this.tree.logDebug('Dynatree._init(): done.');


        var panZoomBar = new OpenLayers.Control.PanZoomBar(null);
        panZoomBar = OpenLayers.Util.extend(panZoomBar, {
             draw: function(px) {
                 OpenLayers.Control.PanZoomBar.prototype.draw.apply(this, [new  OpenLayers.Pixel(250, 0)]);
                 return this.div;
             }
        });
        
        
        
        
        var options = {
                projection: new OpenLayers.Projection('EPSG:900913'),
                displayProjection: new OpenLayers.Projection('EPSG:4326'),

                //maxExtent: new OpenLayers.Bounds(-180, -90, 180, 90),
                //minExtent: new OpenLayers.Bounds(-1, -1, 1, 1),
                //numZoomLevels: 19,
                units: 'm',

//                maxExtent: [-18924313.432222, -15538711.094146, 18924313.432222, 15538711.094146],
//                restrictedExtent: [-13358338.893333, -9608371.5085962, 13358338.893333, 9608371.5085962],
//                scales: [50000000, 30000000, 10000000, 5000000],
//                resolutions: [1.40625,0.703125,0.3515625,0.17578125,0.087890625,0.0439453125],
//                minScale: 50000000,
//                maxResolution: 'auto',
//                maxScale: 10000000,
//                minResolution: 'auto',

                controls: [
                            new OpenLayers.Control.Navigation(),
//                            new OpenLayers.Control.LayerSwitcher(),
                            panZoomBar,
                            new OpenLayers.Control.MousePosition(),
//                                new OpenLayers.Control.OverviewMap(),
                            //new OpenLayers.Control.PanZoomBar(),
                            new OpenLayers.Control.ScaleLine(),
                            new OpenLayers.Control.Attribution()
                ]
        };


        this.map = new OpenLayers.Map(this.domElement, options);

        /*
         * Renderer init (needed for outlines of labels)
         */
        
        var renderer = OpenLayers.Util.getParameters(window.location.href).renderer;
        renderer = (renderer) ? [renderer] : OpenLayers.Layer.Vector.prototype.renderers;

        //console.log('The renderer is: ' + renderer);


        /*
         * Style definitions 
         */
        
        var defaultStyle = OpenLayers.Feature.Vector.style['default'];
        
        this.styles = {};
        
        //OpenLayers.Feature.Vector.style['temporary']['fillColor'] = '#8080a0';
        this.styles.hoverStyle = OpenLayers.Util.extend(
            OpenLayers.Util.extend({}, defaultStyle), {
                fillColor: '#8080ff',
                fillOpacity: 0.4,
                stroke: true,
                strokeLinecap: 'round',
                strokeWidth: 1,
                strokeColor: '#5050a0',
                pointRadius: 12,
                label: self.options.zoomLabel,
                fontColor: '#8080ff', //'#ffffff',
                fontWeight: 'bold'
            }
        );
        //console.log('HoverStyle: ', this.styles.hoverStyle);
        

        this.styles.markerStyle = OpenLayers.Util.extend(
            OpenLayers.Util.extend({}, defaultStyle), {
                //externalGraphic: config.markerUrlDefault,
                graphicOpacity: 0.8, //0.8,
                graphicWidth: 31,
                graphicHeight: 31,
                graphicYOffset: -31,
                graphicXOffset: -16,

                fillColor: '${fillColor}',
                strokeColor: '${strokeColor}',

                
//                stroke: true,
//                strokeColor: '#0000FF',
//                strokeOpacity: 0.8,
//                strokeWidth: 1,
//                fillColor: '#0055FF',
//                fillOpacity: 0.6,
//                pointRadius: '${radius}',
//                pointerEvents: 'visiblePainted',
//    
//                fontColor: '#0000FF', //'#0000FF',
                fontColor: '${fontColor}',
                fontSize: '12px',
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                //labelAlign: 'cm',
//                
                label: '${shortLabel}', //'${label}',
                //labelXOffset: 0,
                labelYOffset: 21
//                labelOutlineColor: '#0080FF',
//                labelOutlineWidth: 3
            }
        );
        //console.log('MarkerStyle', this.styles.markerStyle);
        

        this.styles.boxStyle = OpenLayers.Util.extend(
            OpenLayers.Util.extend({}, defaultStyle), {
                fillColor: '#8080ff',
                fillOpacity: 0.2,
                stroke: true,
                strokeLinecap: 'round',
                strokeWidth: 1,
                strokeColor: '#7070ff',
                pointRadius: 12,
                //fill: false,
                //externalGraphic: 'src/main/resources/images/org/openclipart/people/mathec/magnifying_glass.svg',
                //graphicOpacity: 0.4,
                //graphicWidth: 100,
                //graphicHeight: 100
                label: self.options.zoomLabel,
                fontColor: '#8080ff', //'#ffffff',
                fontWeight: 'bold'
                //backgroundGraphic: 'src/main/resources/images/org/openclipart/people/mathec/magnifying_glass.svg',
                //backgroundHeight: 100,
                //backgroundWidth: 100
            }
        );
    //);

        
        
        
        /*
         * Layer creation 
         */
        
        // The layer for the massive instance indicator boxes
        this.boxLayer = new OpenLayers.Layer.Vector('Boxes', {
            projection: new OpenLayers.Projection('EPSG:4326'),
            visibility: true,
            displayInLayerSwitcher: true,
            renderers: renderer
        });
        

        // The layer for the actual features        
        this.featureLayer = new OpenLayers.Layer.Vector('Features', {
            projection: new OpenLayers.Projection('EPSG:4326'),
            visibility: true,
            displayInLayerSwitcher: true,
            styleMap: new OpenLayers.StyleMap({'default': new OpenLayers.Style(this.styles.markerStyle)}),
            renderers: renderer
        });

        // TODO Make it easy to exchange the URL pattern
        //var mapnikLayer = new OpenLayers.Layer.OSM.Mapnik('Mapnik');
        
        var mapnikLayer = new OpenLayers.Layer.OSM('Mapnik', 'http://a.tile.openstreetmap.org/${z}/${x}/${y}.png', {numZoomLevels: 19}); //http://a.tile.openstreetmap.org
        
        
        //var mapnikLayer = new OpenLayers.Layer.OSM.Local('Mapnik');
        this.map.addLayers([mapnikLayer, this.boxLayer, this.featureLayer]); //, this.vectorLayer]); //, this.markerLayer]);


        /*
         * Forward some simple events
         */
        this.map.events.register('moveend', this, function(event) {
            self._trigger('mapevent', event, {'map': self.map});
        });
        
        this.map.events.register('zoomend', this, function(event) {
            self._trigger('mapevent', event, {'map': self.map});
        });

        /*
        this.map.events.register('moveend', this, function(event) {
            self._trigger('onMapEvent', event, {'map': self.map});
        });
        
        this.map.events.register('zoomend', this, function(event) {
            self._trigger('onMapEvent', event, {'map': self.map});
        });
        */
        

        var report = function() {
            //alert('test');
        };
        
        

        // TODO Following example is probably how to do it the proper way:
        // http://openlayers.org/dev/examples/select-feature-multilayer.html
        
        
        
        this.highlightController = new OpenLayers.Control.SelectFeature(this.boxLayer, {
            hover: true,
            highlightOnly: true,
            //renderIntent: 'temporary',
            selectStyle: this.styles.hoverStyle,


            eventListeners: {
                beforefeaturehighlighted: function(event) {

                    var feature = event.feature;
                    
                    var geometry = feature.geometry;
                                        
                    if(geometry instanceof OpenLayers.Geometry.Point) {
                        
                        // Seems like we can abort the highlight by returning false here.
                        // However, a seemingly cleaner solution would be to keep MII-boxes and features in separate layers
                        return false;
                    }
                    
                }
                /*
                featurehighlighted: report,
                featureunhighlighted: report
                */

            }
        });
        
        this.highlightController.handlers.feature.stopDown = false;
        this.map.addControl(this.highlightController);
        this.highlightController.activate();

        
        
        
        this.selectFeatureController = new OpenLayers.Control.SelectFeature([this.boxLayer, this.featureLayer], {

            onUnselect: function(feature) {
                var data = feature.attributes;
                
                var event = null;
                self._trigger('featureUnselect', event, data);
            },
            
            onSelect: function(feature) {
                                
                //var vector = feature; // Note: We assume a vector feature - might have to check in the future                
                var data = feature.attributes;
                var geometry = feature.geometry;
                
                // FIXME Find a better way to get the click coordinates; but it might not exists yet, see http://trac.osgeo.org/openlayers/ticket/2089
                var xy = this.handlers.feature.evt.xy;
                
                
                if(data.zoomable && geometry instanceof OpenLayers.Geometry.Polygon) {
                    
                    //alert(JSON.stringify(data) + data.zoomable);

                    /*
                     * New method forzooming in onto the click position
                     */
                    var clickLonLat = self.map.getLonLatFromViewPortPx(xy);
                    var currentZoom = self.map.getZoom();
                    var nextZoom = currentZoom + 1;
                    var numZoomLevels = self.map.getNumZoomLevels();
 
                    if(nextZoom >= numZoomLevels) {
                        nextZoom = numZoomLevels - 1;
                    }
                    
                    self.map.setCenter(clickLonLat, nextZoom);
                }
                else {
                    var event = null;
                    self._trigger('featureSelect', event, data);
                }
            }
        });
        
        this.selectFeatureController.handlers.feature.stopDown = false;
        this.map.addControl(this.selectFeatureController);
        this.selectFeatureController.activate();

        
        
        

//        beforefeaturehighlighted    Triggered before a feature is highlighted
//        featurehighlighted    Triggered when a feature is highlighted
//        featureunhighlighted    Triggered when a feature is unhighlighted
//        boxselectionstart    Triggered before box selection starts
//        boxselectionend    Triggered after box selection ends
        
        //this.map.events.register('boxselectionstart', null, function(event) {alert('yay'); });
        
        //this.map.addLayers([this.markerLayer]);

        
        /*
        var size = new OpenLayers.Size(21,25);
        var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
        var icon = new OpenLayers.Icon('http://www.openstreetmap.org/openlayers/img/marker.png',size,offset);
        */

        //var center = new OpenLayers.LonLat(12.3747, 51.3405);
        var center = new OpenLayers.LonLat(-3.56, 56.07);
        
        var tCenter = center.clone().transform(
                this.map.displayProjection,
                this.map.projection);
        
        //console.log(center);
        this.map.setCenter(tCenter, 3);
        

        this.redraw();
        
//new OpenLayers.Projection('EPSG:4326'), // transform from WGS 1984
//new OpenLayers.Projection('EPSG:900913') // to Spherical Mercator Projection
        
        

        //map.events.register('click'  , map, function(event) { Dispatcher.fireEvent('mapEvent', self.getBound());});
        //this.map.events.register('moveend', this.map, function(event) { Dispatcher.fireEvent('mapEvent', self.getBound());});
        //this.map.events.register('zoomend', this.map, function(event) { Dispatcher.fireEvent('mapEvent', self.getBound());});

        //this.map.events.register('moveend', this, function(event) { this.onMapEvent(event); });
        //this.map.events.register('zoomend', this, function(event) { this.onMapEvent(event); });

        //console.log(self);
        
        //this._doBind();
    },

    getFeatureLayer: function() {
        return this.featureLayer;
    },

    
    /**
     * Calls .redraw() on all layers.
     * 
     * Motivation: Workaround for an RDFauthor bug, where the map behaves strange after saving a resource.
     */
    redraw: function() {
        this.boxLayer.redraw();
        this.featureLayer.redraw();
    },

    addWkt: function(id, wktStr, attrs, visible) {

        //console.log('Added: ', id + ' --- ' + wktStr);
        
        var feature = this.wktParser.read(wktStr);
        feature.geometry.transform(this.map.displayProjection, this.map.projection);
        //var geometry = feature.geometry; 
        //feature.geometry.transform(this.map.displayProjection, this.map.projection);

        /*
            var newAttrs = OpenLayers.Util.extend(
                    OpenLayers.Util.extend({}, attrs), {
                        point: point,
                        nodeId: id,
                        label: attrs.abbr,
                        radius: 12
                    }
                );

            var green = OpenLayers.Util.applyDefaults(green, OpenLayers.Feature.Vector.style['default']);

            feature.attributes = newAttrs
          */
        feature.attributes = attrs;
        //feature.data = attrs;
        //feature.geometry = g;
                
        /*
        var newAttrs = OpenLayers.Util.extend(
            OpenLayers.Util.extend({}, attrs), {
                point: point,
                nodeId: id,
                label: attrs.abbr,
                radius: 12
            }
        );
        */
        
        //console.log('Feature attributes: ', newAttrs);
        //{point: point, nodeId: nodeId}
        //alert(JSON.stringify(attrs));
        //alert(JSON.stringify(newAttrs)); , this.styles.markerStyle
        //var feature = new OpenLayers.Feature.Vector(geometry, attrs);
        this.idToFeature[id] = feature;
        
        this.featureLayer.addFeatures([feature]);
        
        //return result;
    },
    
    /**
     * Creates a feature for the given id.
     * By default they are not added to the map (i.e. invisible).
     * 
     * 
     * @param id
     * @param lonlat
     */
    addItem: function(id, lonlat, attrs, visible) {
        
        var feature = this.idToFeature[id];
        if(feature) {
            //console.log('Feature already existed, replacing.')
            
            this.removeItem(id);
        }
        
        
        feature = this.createMarker(id, lonlat, attrs);
        //this.idToFeature.put(id, feature);
        this.idToFeature[id] = feature;
        //console.log('Adding feature/marker');
        //console.log(feature);
        
        if(visible) {
            /////this.markerLayer.addMarker(feature.marker);
            this.featureLayer.addFeatures([feature]);
        }
    },
    
    setVisible: function(id, value) {
        var feature = this.idToFeature.get(id);
        if(!feature) {
            return;
        }
        
        if(value) {
            /////this.markerLayer.addMarker(feature.marker);
            this.featureLayer.addFeatures([feature]);
        } else {
            /////this.markerLayer.removeMarker(feature.marker);
            this.featureLayer.removeFeatures([feature]);
        }
    },
    
    // Fixme: combine pos with attrs?
    addItems : function(idToPos, idToAttrs) {
        for(var id in idToLonlat) {
            var lonlat = idToLonlat[id];
            var attrs = idToAttrs[id];
            this.addItem(id, lonlat, attrs, true);
        }
        /*
        $.each(idToPos, function(id, point) {
            //var point = idToPos[id];

            //point = point.transform(self.map.displayProjection, self.map.projection);
            //console.log(point);
            
        });
        */
    },
    
    clearItems: function() {
        //this.removeItems(_.keys(this.idToFeature.entries));
        this.removeItems(_(this.idToFeature).keys());
        this.removeBoxes(_(this.idToBox).keys());
        
        this.featureLayer.destroyFeatures();
        this.boxLayer.destroyFeatures();
    },

    removeItem : function(id) {
        //var feature = self.idToFeature.entries[id];
        var feature = this.idToFeature[id];
        if(feature) {
            //self.markerLayer.removeMarker(feature.marker);
            this.featureLayer.removeFeatures([feature]);
            delete this.idToFeature[id];
        } else {
            console.log('[WARN] Id ' + id + ' requested for deletion, but not found in the ' + _.keys(this.idToFeature).length + ' available ones: ', this.idToFeature);
        }
    },
    
    removeItems : function(ids) {
        for(var i = 0; i < ids.length; ++i) {
            var id = ids[i];
            
            this.removeItem(id);
        }
    },
    
    _intersectBounds : function() {
        
    },
    
    addBox : function(id, bounds) {
        
        var self = this;
        
        var existingBox = this.idToBox[id];
        if(existingBox) {
            this.removeBox(id);
        }
        
        //console.log('Adding box: ' + bounds);

        var limit = new OpenLayers.Bounds(-179.999, -85.0, 179.999, 85.0);

        
        var newBounds = new OpenLayers.Bounds(
                Math.max(bounds.left, limit.left),
                Math.max(bounds.bottom, limit.bottom),
                Math.min(bounds.right, limit.right),
                Math.min(bounds.top, limit.top));
        
        
        // Example: Convert the input WGS84 to EPSG:900913
        newBounds.transform(this.map.displayProjection, this.map.projection);
        
        
        // a = original lonlat, b = screen space, c = modified lonlal
        var orig_ll_min = new OpenLayers.LonLat(newBounds.left, newBounds.bottom);
        var orig_ll_max = new OpenLayers.LonLat(newBounds.right, newBounds.top);
        //console.log('mmi orig_ll', orig_ll_min, orig_ll_max);
                
        
        //aMin.transform(this.map.displayProjection, this.map.projection);
        var orig_px_min = this.map.getPixelFromLonLat(orig_ll_min);
        var orig_px_max = this.map.getPixelFromLonLat(orig_ll_max);
        //console.log('mmi orig_px', orig_px_min, orig_px_max);
        
        var border_px = 10;
        
        var border_px_min = new OpenLayers.Pixel(orig_px_min.x + border_px, orig_px_min.y - border_px);
        var border_px_max = new OpenLayers.Pixel(orig_px_max.x - border_px, orig_px_max.y + border_px);
        //console.log('mmi border_px', border_px_min, border_px_max);
        
//        border_px_min = orig_px_min;
//        border_px_max = orig_px_max;
        
        
        var border_ll_min = this.map.getLonLatFromPixel(border_px_min);
        var border_ll_max = this.map.getLonLatFromPixel(border_px_max);
        //console.log('mmi border_ll', border_ll_min, border_ll_max);
        
        var b = new OpenLayers.Bounds(
                border_ll_min.lon,
                border_ll_min.lat,
                Math.max(border_ll_min.lon, border_ll_max.lon),
                Math.max(border_ll_min.lat, border_ll_max.lat));
        

        
        //console.log('Box style: ', this.styles.boxStyle);
        var boxFeature = new OpenLayers.Feature.Vector(b.toGeometry(), {
            zoomable: true,
        }, this.styles.boxStyle);
        
        this.boxLayer.addFeatures([boxFeature]);
        this.idToBox[id] = boxFeature;
    },
    
    
    removeBoxes: function(ids) {
        var self = this;
        _(ids).each(function(id) {
            self.removeBox(id);
        });
    },
    
    removeBox : function(id) {
        var box = this.idToBox[id];
        if(box) {
            //this.boxLayer.removeMarker(box);
            this.boxLayer.removeFeatures([box]);
        }
    },

    /*
    setNodeToPos: function(nodeToPos) {
        console.log(nodeToPos);
        var self = this;
        
        //self.idToFeature.removeAll(getKeys(change.removed));

        for(id in self.idToFeature.entries) {
            var feature = self.idToFeature.entries[id];
            self.markerLayer.removeMarker(feature.marker);
        }
        
        this.idToFeature.clear();
        
        for(id in nodeToPos) {
            var point = nodeToPos[id];

            //point = point.transform(self.map.displayProjection, self.map.projection);
            //console.log(point);
            
            var feature = self.createMarker(point, id);
            self.idToFeature.put(id, feature);
            //console.log('Adding feature/marker');
            //console.log(feature);
            self.markerLayer.addMarker(feature.marker);
        }
        
        

    },
    */
    
    _doBind: function() {

        var self = this;
        
        /**
         * For each entry in the nodeToPos map we create a feature
         */
        /*
        $(this.nodeToPos).bind('changed', function(event, change) {
            
            self.idToFeature.removeAll(getKeys(change.removed));

            //console.log('pos');
            console.log(change);
            for(id in change.added) {
                var point = change.added[id].clone();

                //point = point.transform(self.map.displayProjection, self.map.projection);
                //console.log(point);
                
                var marker = self.createMarker(point, id);
                self.idToFeature.put(id, marker);
            }        
        });
        */

        
        /**
         * We add all nodeFeatures to the map 
         */
        /*
        $(this.idToFeature).bind('changed', function(event, change) {
            for(key in change.removed) {
                //console.log('Features removed');
                var marker = change.removed[key].marker;
                self.markerLayer.removeMarker(marker);
                //self.vectorLayer.removeMarker(value);
            }


            for(key in change.added) {
                var marker = change.added[key].marker;
                self.markerLayer.addMarker(marker);
                //self.vectorLayer.addMarker(value);
            }        
        });
        */
            
        /*
        $(this.wayToFeature).bind('changed', function(event, change) {
            
            for(key in change.removed) {
                //console.log('Features removed');
                value = change.removed[key];
                self.vectorLayer.removeFeatures([value]);
            }


            for(key in change.added) {
                value = change.added[key];
                self.vectorLayer.addFeatures([value]);
                //console.log(value);
            }        

            //self.wayToFeature.put(key, polygonFeature);
            //self.vectorLayer.addFeatures([polygonFeature]);
            
            
        });
        */
    },
    
    _pointToScreen: function(point) {
        return point.clone().transform(this.map.displayProjection, this.map.projection);
    },
    
    createMarker: function(id, point, attrs) {

        
        /*
        var style_blue = OpenLayers.Util.extend({}, layer_style);
        style_blue.strokeColor = 'blue';
        style_blue.fillColor = 'blue';
        style_blue.graphicName = 'star';
        style_blue.pointRadius = 10;
        style_blue.strokeWidth = 3;
        style_blue.rotation = 45;
        style_blue.strokeLinecap = 'butt';
        */
        
        var tPoint = point.clone().transform(this.map.displayProjection, this.map.projection);
        
        var pt = new OpenLayers.Geometry.Point(tPoint.lon, tPoint.lat);
        
        var newAttrs = OpenLayers.Util.extend(
            OpenLayers.Util.extend({}, attrs), {
                point: point,
                nodeId: id,
                label: attrs.abbr,
                radius: 12
            }
        );
        
        //console.log('Feature attributes: ', newAttrs);
        //{point: point, nodeId: nodeId}
        //alert(JSON.stringify(attrs));
        //alert(JSON.stringify(newAttrs)); , this.styles.markerStyle
        var result = new OpenLayers.Feature.Vector(pt, newAttrs);
        //console.log('Feature attributes: ', result.attributes);

        //result.attributes = {label: 'test'};
        
        return result;
    },
    
    
    /*
    createMarkerOld: function(point, nodeId) {
        //console.log('Creating marker: ' + point);
        
        var types = this.nodeToTypes.get(nodeId);
        var type = null;
        if(types) {
            type = types[0];
        }
        
        var iconUrl = type ? this.schemaIcons.get(type) : null;
        
        if(!iconUrl || iconUrl == '(missing icon)') {
            iconUrl = config.markerUrlDefault; //'src/main/resources/icons/markers/marker.png';//'http://www.openlayers.org/dev/img/marker.png';
        }
        
        //point = new OpenLayers.LonLat(-1, 52);
        
        var tPoint = point.clone().transform(this.map.displayProjection, this.map.projection);
        //var tPoint = point;
        
        //console.log(tPoint);
        
        var size = new OpenLayers.Size(21, 25);
        var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
        var icon = new OpenLayers.Icon(iconUrl, size, offset);

        /*
        markers.addMarker(new OpenLayers.Marker(new OpenLayers.LonLat(0,0),icon));
        * 

        
        var feature = new OpenLayers.Feature(this.markerLayer, tPoint, {icon: icon});
        feature.closeBox = true;
        feature.popupClass = OpenLayers.Class(OpenLayers.Popup.FramedCloud,{'panMapIfOutOfView':false, 'autoSize': true});
        //feature.data.popupContentHTML = 'No content loaded yet';
        feature.data.overflow = 'auto';

        var marker = feature.createMarker();

        var self = this;
        var markerClick = function(event) {
            
            OpenLayers.Event.stop(event);
            
            self._trigger('onMarkerClick', event, {'nodeId': nodeId, 'feature': feature});
            
            /*
            for (var i = self.map.popups.length - 1; i >= 0; --i) {
                self.map.popups[i].hide();
            }
            if (this.popup == null) {
                this.popup = this.createPopup(this.closeBox);
                self.map.addPopup(this.popup);
                this.popup.show();
            } else {
                this.popup.toggle();
            }
            
            this.popup.setContentHTML(self.nodeToLabels.get(nodeId));
            
            //loadData(currentPopup, nodeId, xlon, xlat, tags);
            * /
        };
        
        //marker.events.register('mouseover', feature, markerClick);
        //marker.events.register('mouseout', feature, markerClick);
        marker.events.register('click', feature, markerClick);
         //* /
        
        //markerLayer.addMarker(marker);
        
        return feature;
    },
    */


    getExtent: function() {
        return this.map.getExtent().transform(this.map.projection, this.map.displayProjection);
    },

    
//    saveState: function() {
//        var result = {
//                center: this.map.getCenter(),
//                zoom: this.map.getZoom()
//        };
//        
//        return result;
//    },

    getState: function() {
        var map = this.map;
        
        var tmp = map.getCenter();
        var lonlat = tmp.transform(map.projection, map.displayProjection);

        var center = {lon: lonlat.lon, lat: lonlat.lat};
        var zoom = map.getZoom();
        
        var result = {
            center: center,
            zoom: zoom
        };
        
        console.log('Saved center', center);
        
        return result;
    },

    
    loadState: function(state) {
        if(!state) {
            return;
        }

        var map = this.map;

        var c = state.center;
        console.log('Load raw center ', c);
        var center;
        if(c) {
            var tmp = new OpenLayers.LonLat(state.center.lon, state.center.lat);
            center = tmp.transform(map.displayProjection, map.projection);
        }
        else {
            center = this.map.getCenter();
        }
        
        console.log('Loaded center ', center);
        var zoom = state.zoom ? state.zoom : this.map.getZoom();
        
        this.map.setCenter(center, zoom, false, false);
    },
    
    getElement: function() {
        return this.domElement;
    }
    
    
    /*
    onMapEvent: function(event) {
        $(this.domElement).trigger('onMapEvent', event, this.map);
    }*/
});

})(jQuery);

// Legacy version - don't use if you don't have to

angular.module('ui.jassa.openlayers.jassa-map-ol-a', [])

.controller('JassaMapOlACtrl', ['$scope', '$rootScope', function($scope, $rootScope) {
        
        var refresh;
        
        var defaultViewStateFetcher = new Jassa.geo.ViewStateFetcher();

        // Make Jassa's ObjectUtils known to the scope - features the hashCode utility function
        $scope.ObjectUtils = Jassa.util.ObjectUtils;
        
        
        $scope.$watch('config', function(config, oldConfig) {
            //console.log('Config update: ', config);
            
            if(_(config).isEqual(oldConfig)) {
                return;
            }
            
            //console.log('Compared: ' + JSON.stringify(config) + ' -> ' + JSON.stringify(oldConfig));
            
            Jassa.setOlMapCenter($scope.map, config);
        }, true);
        

        var watchList = '[map.center, map.zoom, ObjectUtils.hashCode(sources)]'; //viewStateFetcher
        
        $scope.$watch(watchList, function() {
            //console.log('Map refresh: ' + Jassa.util.ObjectUtils.hashCode($scope.config));
            refresh();
        }, true);
        
        
        refresh = function() {
             
            var mapWrapper = $scope.map.widget;
 
            mapWrapper.clearItems();

            var dataSources = $scope.sources;
            
            
            var bounds = Jassa.geo.openlayers.MapUtils.getExtent($scope.map);
            
            _(dataSources).each(function(dataSource) {

                var viewStateFetcher = dataSource.viewStateFetcher || defaultViewStateFetcher;
                
                var sparqlService = dataSource.sparqlService;
                var mapFactory = dataSource.mapFactory;
                //var conceptFactory = dataSource.conceptFactory
                var conceptFactory = dataSource.conceptFactory;
                var concept = conceptFactory.createConcept();
                
                var quadTreeConfig = dataSource.quadTreeConfig;
                
                var promise = viewStateFetcher.fetchViewState(sparqlService, mapFactory, concept, bounds, quadTreeConfig);
                
                // TODO How to obtain the marker style?
                promise.done(function(viewState) {
                    var nodes = viewState.getNodes();
                    
                    _(nodes).each(function(node) {
                        //console.log('booooo', node);
                        if(!node.isLoaded) {
                            //console.log('box: ' + node.getBounds());
                            mapWrapper.addBox('' + node.getBounds(), node.getBounds());
                        }
                        
                        var data = node.data || {};
                        var docs = data.docs || [];

                        _(docs).each(function(doc) {
                            var itemData = {
                                id: doc.id,
                                config: dataSource // Make the dataSource object part of the marker's data
                            };

							var wkt = doc.wkt.getLiteralLexicalForm();

                            mapWrapper.addWkt(doc.id, wkt, itemData);// {fillColor: markerFillColor, strokeColor: markerStrokeColor});
                            
                        });
                    });
                });
                
                
            });
        };
        
}])

//http://jsfiddle.net/A2G3D/1/
.directive('jassaMapOlA', function($parse) {
    return {
        restrict: 'EA',
        replace: true,
        template: '<div></div>',
        controller: 'JassaMapOlACtrl',
        scope: {
            config: '=',
            sources: '=',
            onSelect: '&select',
            onUnselect: '&unselect'
        },
        link: function (scope, element, attrs) {
            
            var $el = jQuery(element).ssbMap();
            var widget = $el.data('custom-ssbMap');

            var map = widget.map;
            map.widget = widget;
            
            scope.map = map;

            Jassa.setOlMapCenter(scope.map, scope.config);

            
            var syncModel = function(event) {
                var tmp = scope.map.getCenter();
                var center = tmp.transform(scope.map.projection, scope.map.displayProjection);
                
                //console.log('syncModel', center);

                scope.config.center = {lon: center.lon, lat: center.lat};
                scope.config.zoom = scope.map.getZoom();
                if(!scope.$root.$$phase) {
                    scope.$apply();
                }
            };

            
            $el.on('ssbmapfeatureselect', function(ev, data) {
                scope.onSelect({data: data});
            });

            $el.on('ssbmapfeatureunselect', function(ev, data) {
                scope.onUnselect({data: data});
            });
                    
            
            map.events.register('moveend', this, syncModel);
            map.events.register('zoomend', this, syncModel);
        }
            
    };
})

;

