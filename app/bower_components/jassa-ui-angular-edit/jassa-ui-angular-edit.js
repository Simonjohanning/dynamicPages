/*
 * jassa-ui-angular-edit
 * https://github.com/GeoKnow/Jassa-UI-Angular

 * Version: 0.9.0-SNAPSHOT - 2015-03-25
 * License: BSD
 */
angular.module("ui.jassa.edit", ["ui.jassa.geometry-input","ui.jassa.rdf-term-input","ui.jassa.rex","ui.jassa.sync"]);
angular.module('ui.jassa.geometry-input', [])

  .provider('GeocodingLookup', function() {

    this.config = {
      service: ['Nominatim', 'LinkedGeoData'],
      defaultService: false
    };

    // a collection of pre-set service configs
    this.defaultServices = {
      Nominatim: {
        label: 'Nominatim',
        serviceType: 'rest',
        url: 'http://nominatim.openstreetmap.org/search/?format=json&polygon_text=1&q=',
        data: {
          format: 'json',
          polygon_text: '1',
          q: '%KEYWORD%'
        },
        fnSuccess: function(response) {
          var data = response.data;
          var resultSet = [];
          for (var i in data) {
            if (data[i].hasOwnProperty('geotext')) {
              resultSet.push({
                firstInGroup: false,
                wkt: data[i].geotext,
                label: data[i].display_name,
                group: 'Nominatim'
              });
            }
          }
          return resultSet;
        }
      },
      LinkedGeoData: {
        label: 'LinkedGeoData',
        serviceType: 'sparql',
        endpoint: 'http://linkedgeodata.org/vsparql',
        graph: 'http://linkedgeodata.org/ne/',
        prefix: {
          ogc: 'http://www.opengis.net/ont/geosparql#',
          geom: 'http://geovocab.org/geometry#'
        },
        query: '{'
          +' Graph <http://linkedgeodata.org/ne/> {'
          +' ?s a <http://linkedgeodata.org/ne/ontology/Country> ;'
          +' rdfs:label ?l ;'
          +' geom:geometry ['
          +'  ogc:asWKT ?g'
          +' ] '
          +' FILTER regex(?l, "%KEYWORD%", "i") '
          +' } '
          +'}',
        sponateTemplate: [{
          id: '?s',
          label: '?l',
          wkt: '?g'
        }],
        limit: 5,
        fnSuccess: function(response) {
          var data = response;
          var resultSet = [];
          if (data.length > 0) {
            for(var i in data) {
              resultSet.push({
                'firstInGroup': false,
                'wkt': data[i].val.wkt,
                'label': data[i].val.label,
                'group': 'LinkedGeoData'
              });
            }
          }
          return resultSet;
        }
      }
    };

    // stores service configs which are set by the
    // GeocodingLookupProvider.setService function call
    this.userServices = {};

    this.$get = function() {
      // inject $http and $q
      var initInjector = angular.injector(['ng']);
      var $http = initInjector.get('$http');
      var $q = initInjector.get('$q');

      var promiseCache = {
        /** Meta Information
         * [{
         *   label: x,
         *   promiseID: y
         * }]
         */
        promisesMetaInformation: [],
        promises: []
      };

      // use default config of geocoding services when no services are set by user
      var useServiceConfig = {};

      for (var i in this.config.service) {
        var serviceLabel = this.config.service[i];
        useServiceConfig[serviceLabel] = this.defaultServices[serviceLabel];
      }

      if(!_(this.userServices).isEmpty()) {
        if (this.config.defaultService) {
          _(useServiceConfig).extend(this.userServices);
        } else {
          useServiceConfig = this.userServices;
        }
      }

      var setPromise = function(serviceLabel, promise) {
        // needed for identify a promise to a service
        // the first promise matches the first promiseMetaInformation
        var promiseID = promiseCache.promises.length;
        promiseCache.promisesMetaInformation.push({
          label: serviceLabel,
          promiseID: promiseID
        });
        promiseCache.promises.push(promise);
      };

      // returns the promiseCache
      var getPromises = function() {
        return promiseCache;
      };

      var clearPromiseCache = function() {
        promiseCache.promises = [];
        promiseCache.promisesMetaInformation = [];
      };

      var createSparqlService = function(url, graphUris) {
        var result = jassa.service.SparqlServiceBuilder.http(url, graphUris, {type: 'POST'})
          .cache().virtFix().paginate(1000).pageExpand(100).create();
        return result;
      };

      var requestGeocodingService = function(service, keyword) {
        if (service.serviceType === 'rest') {
          return restServiceRequest(service, keyword);
        }
        if (service.serviceType === 'sparql') {
          return sparqlServiceRequest(service, keyword);
        }
      };

      var restServiceRequest = function(service, keyword) {
        var queryString = queryData(service.data).replace(/%KEYWORD%/gi,keyword);
        return $http({
          'method': 'GET',
          'url': service.url+'?'+queryString,
          'cache': true,
          'headers' : {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
      };

      var sparqlServiceRequest = function(service, keyword) {

        var sparqlService = createSparqlService(service.endpoint, service.graph);

        var store = new jassa.sponate.StoreFacade(sparqlService, _(service.prefix)
          .defaults(jassa.vocab.InitialContext));

        var query = service.query.replace(/%KEYWORD%/gi,keyword);

        var limit = service.limit || 10;

        store.addMap({
          name: 'sparqlService',
          template: service.sponateTemplate,
          from: query
        });

        return store.sparqlService.getListService().fetchItems(null, limit);
      };

      var queryData = function(data) {
        var ret = [];
        for (var d in data) {
          ret.push(d + '=' + data[d]);
        }
        return ret.join('&');
      };

      var firstInGroupTrue = function(results) {
        results = _(results).flatten();
        // mark the first of each group for headlines
        results = _(results).groupBy('group');
        results = _(results).map(function(g) {
          g[0].firstInGroup = true;
          return g;
        });
        results = _(results).flatten();
        results = _(results).value();
        return results;
      };

      return {
        findByKeyword: function(keyword) {
          // clear promise cache for new requests
          clearPromiseCache();

          // start requesting the services and collect the promises
          for(var serviceLabel in useServiceConfig) {
            var service = useServiceConfig[serviceLabel];
            var promise = requestGeocodingService(service, keyword);
            setPromise(serviceLabel, promise);
          }

          // wait until all requests are done and return final resultSet
          var promiseCache = getPromises();
          var resultPromise = $q.all(promiseCache.promises).then(function(response) {
            var results = [];
            // iterate through all responses and insert the result into results
            for (var i in response) {
              var data = response[i];
              var serviceLabel = promiseCache.promisesMetaInformation[i].label;
              // insert the result of a response into the final results-array
              var result = useServiceConfig[serviceLabel].fnSuccess(data);
              results.push(result);
            }

            return firstInGroupTrue(results);
          });

          return resultPromise;
        }
      };
    };

    this.setService = function(serviceConfig) {
      this.userServices[serviceConfig.label] = serviceConfig;
    };

    this.setConfiguration = function(userConfig) {
      _(this.config).extend(userConfig);
    };

  })

  .directive('geometryInput', ['$http', '$q', 'GeocodingLookup', function($http, $q, GeocodingLookup) {

    var uniqueId = 1;

    return {
      restrict: 'EA',
      priority: 4,
      require: '?ngModel',
      templateUrl: 'template/geometry-input/geometry-input.html',
      replace: true,
      scope: {
        bindModel: '=ngModel',
        ngModelOptions: '=?',
        geocodingServices: '=geocodingServices'
      },
      controller: ['$scope', function($scope) {

        $scope.ngModelOptions = $scope.ngModelOptions || {};
        $scope.geometry = 'point';
        $scope.isLoading = false;

        $scope.fetchResults = function(searchString) {
          return GeocodingLookup.findByKeyword(searchString);
        };

        $scope.onSelectGeocode = function(item) {
          console.log('onselect', item);
          $scope.bindModel = item.wkt;
        };
      }],
      compile: function(ele, attrs) {
        return {
          pre: function (scope, ele, attrs, ngModel) {
            ngModel.$name = scope.$eval(attrs.name);

            scope.searchString = '';

            var map, drawControls, polygonLayer, panel, wkt, vectors;

            scope.$watch(function () {
              return scope.bindModel;
            }, function (newValue, oldValue) {
              //console.log('old value of input', oldValue);
              // clear layer
              vectors.destroyFeatures();
              // set config data with changed input value ...
              scope.bindModel = newValue;
              // ... then call parseWKT to redraw the feature
              if (scope.bindModel != null) {
                parseWKT();
              }
            });

            scope.$watch(function () {
              return scope.geometry;
            }, function (newValue) {
              //console.log('radio', scope.geometry-input-input);
              //scope.geometry-input-input = newValue;
              toggleControl();
            });

            function init() {
              // generate custom map id
              var mapId = 'openlayers-map-' + uniqueId++;
              // set custom map id
              ele.find('.map').attr('id', mapId);
              // init openlayers map with custom map id
              map = new OpenLayers.Map(mapId);

              var wmsLayer = new OpenLayers.Layer.WMS('OpenLayers WMS',
                'http://vmap0.tiles.osgeo.org/wms/vmap0?', {layers: 'basic'});

              panel = new OpenLayers.Control.Panel({'displayClass': 'olControlEditingToolbar'});

              var snapVertex = {methods: ['vertex', 'edge'], layers: [vectors]};

              // allow testing of specific renderers via "?renderer=Canvas", etc
              var renderer = OpenLayers.Util.getParameters(window.location.href).renderer;
              renderer = (renderer) ? [renderer] : OpenLayers.Layer.Vector.prototype.renderers;

              vectors = new OpenLayers.Layer.Vector('Vector Layer', {
                renderers: renderer
              });

              map.addLayers([wmsLayer, vectors]);
              map.addControl(new OpenLayers.Control.LayerSwitcher());
              map.addControl(new OpenLayers.Control.MousePosition());

              vectors.events.on({
                sketchcomplete: GeometryWasDrawn
              });

              wkt = new OpenLayers.Format.WKT();

              drawControls = {
                point: new OpenLayers.Control.DrawFeature(vectors,
                  OpenLayers.Handler.Point, {
                    displayClass: 'olControlDrawFeaturePoint',
                    handlerOptions: snapVertex}),
                line: new OpenLayers.Control.DrawFeature(vectors,
                  OpenLayers.Handler.Path, {
                    displayClass: 'olControlDrawFeaturePath',
                    handlerOptions: snapVertex}),
                polygon: new OpenLayers.Control.DrawFeature(vectors,
                  OpenLayers.Handler.Polygon, {
                    displayClass: 'olControlDrawFeaturePolygon',
                    handlerOptions: snapVertex}),
                box: new OpenLayers.Control.DrawFeature(vectors,
                  OpenLayers.Handler.RegularPolygon, {
                    displayClass: 'olControlDrawFeatureBox',
                    handlerOptions: _.extend({
                      sides: 4,
                      irregular: true
                    }, snapVertex)
                  }),
                modify: new OpenLayers.Control.ModifyFeature(vectors, {
                  snappingOptions: snapVertex,
                  onModificationStart: onModificationStart,
                  onModification: onModification,
                  onModificationEnd: onModificationEnd
                })
              };

              panel.addControls(drawControls['modify']);
              map.addControl(panel);
              panel.activateControl(drawControls.modify);

              for (var key in drawControls) {
                map.addControl(drawControls[key]);
              }

              map.setCenter(new OpenLayers.LonLat(0, 0), 4);
            }

            function GeometryWasDrawn(drawnGeometry) {
              /*var ft = polygonLayer.features;
              for(var i=0; i< ft.length; i++){
                console.log(polygonLayer.features[i].geometry-input-input.getBounds());
                displayWKT(polygonLayer.features[i]);
              }*/
              var wktValue = generateWKT(drawnGeometry.feature);
              scope.bindModel = wktValue;
              scope.$apply();
            }

            function generateWKT(feature) {
              var str = wkt.write(feature);
              str = str.replace(/,/g, ', ');
              return str;
            }

            function parseWKT(pWktString) {
              var wktString = pWktString || scope.bindModel;
              //console.log('parseWKT', scope.bindModel);
              var features = wkt.read(wktString);
              var bounds;
              if (features) {
                if (features.constructor != Array) {
                  features = [features];
                }
                for (var i = 0; i < features.length; ++i) {
                  if (!bounds) {
                    bounds = features[i].geometry.getBounds();
                  } else {
                    bounds.extend(features[i].geometry.getBounds());
                  }

                }
                vectors.addFeatures(features);
                map.zoomToExtent(bounds);
                var plural = (features.length > 1) ? 's' : '';
                //console.log('Added WKT-String. Feature' + plural + ' added');
              } else {
                console.log('Bad WKT');
              }
            }

            function toggleControl() {
              //console.log('toggleControl', scope.geometry-input-input);
              var control = drawControls[scope.geometry];
              for (var key in drawControls) {
                control = drawControls[key];
                if (scope.geometry == key) {
                  control.activate();
                } else {
                  control.deactivate();
                }
              }
            }

            function onModificationStart(feature) {
              //console.log(feature.id + ' is ready to be modified');
              drawControls[scope.geometry].deactivate();
            }

            function onModification(feature) {
              //console.log(feature.id + ' has been modified');
              var wktValue = generateWKT(feature);
              scope.bindModel = wktValue;

              // A modification makes this control dirty
              ngModel.$setDirty();

              if(scope.$$phase) {
                  scope.$apply();
              }
            }

            function onModificationEnd(feature) {
              //console.log(feature.id + ' is finished to be modified');
              drawControls[scope.geometry].activate();
            }

            // init openlayers
            init();

            // set geometry-input-input
            var control = drawControls[scope.geometry];
            control.activate();
          }
        };
      }
    };
  }]);


var rdfTermInputCounter = 0;

angular.module('ui.jassa.rdf-term-input', [])

.directive('rdfTermInput', ['$parse', function($parse) {

    // Some vocab - later we could fetch labels on-demand based on the uris.
    var vocab = {
        iri: 'http://iri',
        plainLiteral: 'http://plainLiteral',
        typedLiteral: 'http://typedLiteral'
    };

    return {
        restrict: 'EA',
        priority: 0,
        //transclude: true,
        //require: ['?^ngForm', 'ngModel'],
        require: 'ngModel',
        templateUrl: 'template/rdf-term-input/rdf-term-input.html',
        replace: true,
        //scope: true,
        scope: {
            //ngModel: '=',
            bindModel: '=ngModel',
            ngModelOptions: '=?',
            logo: '@?',
            langs: '=?', // suggestions of available languages
            datatypes: '=?', // suggestions of available datatypes
            rightButton: '=?'
        },
        controller: ['$scope', function($scope) {

            // The sub widgets will register themselves here
            $scope.forms = {};

            $scope.state = $scope.$state || {};
            $scope.ngModelOptions = $scope.ngModelOptions || {};

            this.setRightButton = function() {
              $scope.rightButton = true;
            };

            $scope.vocab = vocab;

            $scope.termTypes = [
                {id: vocab.iri, displayLabel: 'IRI'},
                {id: vocab.plainLiteral, displayLabel: 'plain'},
                {id: vocab.typedLiteral, displayLabel: 'typed'}
            ];

            var langs = [
                {id: '', displayLabel: '(none)'},
                {id: 'en', displayLabel: 'en'},
                {id: 'de', displayLabel: 'de'},
                {id: 'fr', displayLabel: 'fr'},
                {id: 'zh', displayLabel: 'zh'},
                {id: 'ja', displayLabel: 'ja'}
            ];

//            setModelAttr: function(attr, val) {
//                ngModel.$modelValue[attr] = val;
//                $scope.apply();
//            };

            /*
            $scope.termTypes = [vocab.iri, vocab.plainLiteral, vocab.typedLiteral];

            $scope.termTypeLabels = {};
            $scope.termTypeLabels[vocab.iri] = 'IRI';
            $scope.termTypeLabels[vocab.plainLiteral] = 'plain';
            $scope.termTypeLabels[vocab.typedLiteral] = 'typed';
            */


            $scope.langs = $scope.langs || langs;

            var keys = Object.keys(jassa.vocab.xsd);
            $scope.datatypes = keys.map(function(key) {

                var id = jassa.vocab.xsd[key].getUri();
                return {
                    id: id,
                    displayLabel: jassa.util.UriUtils.extractLabel(id)
                };
            });

            $scope.addLanguage = function(newLanguageValue) {
              return {
                id: newLanguageValue,
                displayLabel: newLanguageValue
              };
            };

            $scope.addDatatype = function(newDatatypeValue) {
              return {
                id: newDatatypeValue,
                displayLabel: newDatatypeValue
              };
            };

        }],
        compile: function(ele, attrs) {
            return {
                //pre: function(scope, ele, attrs, ctrls) {//ngModel) {
//                var ngForm = ctrls[0];
//                var ngModel = ctrls[1];
//
//                if(ngForm) {
//                    console.log(ngForm.$name);
//                }

                pre: function(scope, ele, attrs, ngModel) {

                    ngModel.$name = scope.$eval(attrs.name);

                    // This pristine watching seems like an aweful hack to me :/
                    // But oh well

                    var getSubForms = function() {
                        var r = [
                            scope.forms.type.value,
                            scope.forms.datatype.value,
                            scope.forms.lang.value,
                            scope.forms.value.value
                        ];

                        return r;
                    };

                    var checkPristine = function() {
                        var cs = getSubForms();

                        var r = !cs.some(function(c) {
                            return !c.$pristine;
                        });

                        return r;
                    };

                    scope.$watch(function() {
                        return ngModel.$pristine;
                    }, function(isPristine) {
                        if(isPristine) {
                            var cs = getSubForms();
                            cs.forEach(function(c) {
                                c.$setPristine();
                            });
                        }
                    });

                    scope.$watch(checkPristine, function(isPristine) {
                        if(isPristine) {
                            ngModel.$setPristine();
                        } else {
                            ngModel.$setDirty();
                        }
                    });

//                    scope.$watch('forms.type.value.$pristine', function() {
//                        console.log('YAAAY type' + scope.forms.type.value.$pristine);
//                    });
//
//                    scope.$watch('forms.value.value.$pristine', function() {
//                        console.log('Wooo value' + scope.forms.value.value.$pristine);
//                    });

                    //ngModel.$name = scope.$eval(attrs.name);

                    /*
                    console.log(scope.state);
                    scope.$watch(function() {
                        return ngModel.$pristine;
                    }, function(pristine) {

                    });
                    */


                    scope.rightButton = false;



                    scope.setRightButton = function() {
                      scope.rightButton = true;
                    };

                    var getValidState = function() {
                        var result;

                        var state = scope.state;
                        // {"type":{"id":"http://typedLiteral","displayLabel":"typed"},"value":"297.6","datatype":"http://dbpedia.org/datatype/squareKilometre"}
                        var type = state.type;
                        switch(type) {
                        case vocab.iri:
                            result = {
                                type: 'uri',
                                value: state.value
                            };
                            break;
                        case vocab.plainLiteral:
                            result = {
                                type: 'literal',
                                value: state.value,
                                lang: state.lang,
                                datatype: ''
                            };
                            break;
                        case vocab.typedLiteral:
                            result = {
                                type: 'literal',
                                value: state.value,
                                datatype: state.datatype || jassa.vocab.xsd.xstring.getUri()
                            };
                            break;
                        default:
                            result = {
                                type: 'uri',
                                value: state.value
                            };
                            break;
                        }

                        return result;
                    };

                    var convertToState = function(talisJson) {
                        // IMPORTANT: We cannot apply defaults here on the value taken from the model,
                        // because otherwise
                        // we would expose the state based on the defaults, which could
                        // in turn update the model again and modify its value
                        // Put differently: The model must not be changed unless there is user interaction
                        // with this widget!

                        //var clone = createTalisJsonObjectWithDefaults(talisJson);
                        var clone = talisJson;

                        if(clone.type != null && clone.value == null) {
                            clone.value = '';
                        }

                        var node;
                        try {
                            node = jassa.rdf.NodeFactory.createFromTalisRdfJson(clone);
                        } catch(err) {
                            // Ignore invalid model values, and just wait for them to become valid
                            //console.log(err);
                        }


                        var result;
                        if(!node) {
                            result = {};
                        } else if(node.isUri()) {
                            result = {
                                type: vocab.iri,
                                value: node.getUri()
                            };
                        } else if(node.isLiteral()) {
                            var dt = node.getLiteralDatatypeUri();
                            var hasDatatype = !jassa.util.ObjectUtils.isEmptyString(dt);

                            if(hasDatatype) {
                                result = {
                                    type: vocab.typedLiteral,
                                    value: node.getLiteralLexicalForm(),
                                    datatype: dt
                                };
                            } else {
                                result = {
                                    type: vocab.plainLiteral,
                                    value: node.getLiteralLexicalForm(),
                                    lang: node.getLiteralLanguage()
                                };
                            }
                        }

                        return result;
                    };

                    scope.$watch(function () {
                        var r = scope.bindModel;
                        return r;
                    }, function(talisJson) {
                        //console.log('Got outside change: ', talisJson);

                      if (!talisJson) {
                      } else {
                          var newState = convertToState(talisJson);

  //                            var newState;
  //                            try {
  //                                newState = convertToState(talisJson);
  //                            } catch(err) {
  //                                newState = {};
  //                            }

                          scope.state = newState;

                          // init value of ui-select-box termtype
                          for (var i in scope.termTypes) {
                            if (scope.termTypes[i].id === scope.state.type) {
                              scope.termTypes.selected = scope.termTypes[i];
                              break;
                            }
                          }

                          // init value of ui-select-box datatype
                          var matchedDatatype = false;
                          for (var j in scope.datatypes) {
                            if (scope.datatypes[j].id === scope.state.datatype) {
                              scope.datatypes.selected = scope.datatypes[j];
                              matchedDatatype = true;
                              break;
                            }
                          }

                          // if the datatype is not in hashmap add them
                          if (!matchedDatatype) {
                            //TODO: short uri for displayLabel
                            var prefixMapping = new jassa.rdf.PrefixMappingImpl();
                            // create new datatype set
                            var newDatatype = {
                              id: scope.state.datatype,
                              displayLabel:  prefixMapping.shortForm(scope.state.datatype)
                            };
                            // add new datatype to datatypes
                            scope.datatypes.push(newDatatype);
                            // set datatype as selected
                            scope.datatypes.selected = newDatatype;
                          }

                          // init value of ui-select-box languages
                          var matchedLang = false;
                          for (var k in scope.langs) {
                            if (scope.langs[k].id === scope.state.lang) {
                              scope.langs.selected = scope.langs[k];
                              matchedLang = true;
                              break;
                            }
                          }

                          // if the language is not in hashmap add them
                          if (!matchedLang) {
                            // create new datatype set
                            var newLang = {
                              id: scope.state.lang,
                              displayLabel: scope.state.lang
                            };
                            // add new language to langs
                            scope.langs.push(newLang);
                            // set datatype as selected
                            scope.langs.selected = newLang;
                          }

                        //console.log('ABSORBED', newState, ' from ', talisJson);
                      }
                    }, true);

                    //if(modelSetter) {

                        scope.$watch(function () {
                            var r = getValidState();
                            return r;
                        }, function(newValue) {
                            if(newValue) {
                                //modelSetter(scope, newValue);
                                //scope.bindModel = newValue;

                                angular.copy(newValue, scope.bindModel);
                                //ngModel.$setViewValue(newValue);

                                //if(!scope.$phase) { scope.$apply(); }
                                //console.log('EXPOSED', scope.bindModel);
                            }
                        }, true);


//                        scope.$watch('state', function(state) {
//                            ngModel.$setViewValue(state);
//                        });

                    //}
                }


                // Code below worked with scope:true - but we want an isolated one
                    /*
                    var modelExprStr = attrs['ngModel'];
                    var modelGetter = $parse(modelExprStr);
                    var modelSetter = modelGetter.assign;

                    //console.log('Sigh', modelExprStr, modelGetter(scope));

                    scope.$watch(function () {
                        var r = modelGetter(scope);
                        return r;
                    }, function(talisJson) {
                        //console.log('Got outside change: ', talisJson);

                        if(talisJson) {
                            var newState = convertToState(talisJson);
                            scope.state = newState;
                            //console.log('ABSORBED', newState, ' from ', talisJson);
                        }
                    }, true);

                    if(modelSetter) {

                        scope.$watch(function () {
                            var r = getValidState();
                            return r;
                        }, function(newValue) {
                            if(newValue) {
                                modelSetter(scope, newValue);
                                //console.log('EXPOSED', newValue);
                            }
                        }, true);
                    }
                }
                */
            };
        }
    };
}]);





/**
 * Falsy valued arguments will be replaced with empty strings or 0
 */
var Coordinate = Jassa.ext.Class.create({
    initialize: function(s, p, i, c) {
        this.s = s || '';
        this.p = p || '';
        this.i = i || 0;
        this.c = c || '';
    },

    equals: function(that) {
        var result = this.s === that.s && this.p === that.p && this.i === that.i && this.c === that.c;
        return result;
    },

    hashCode: function() {
        if(this.hash == null) {
            this.hash =
                jassa.util.ObjectUtils.hashCodeStr(this.s) +
                3 * jassa.util.ObjectUtils.hashCodeStr(this.p) +
                7 * this.i +
                11 * jassa.util.ObjectUtils.hashCodeStr(this.c);
        }

        return this.hash;
    },

    toString: function() {
        var result = this.s + ' ' + this.p + ' ' + this.i + ' ' + this.c;
        return result;
    },
});



// Prefix str:
var parsePrefixStr = function(str) {
    regex = /\s*([^:]+)\s*:\s*([^\s]+)\s*/g;
};


var parsePrefixes = function(prefixMapping) {
    var result = prefixMapping
        ? prefixMapping instanceof PrefixMappingImpl
            ? prefixMapping
            : new PrefixMappingImpl(prefixMapping)
        : new PrefixMappingImpl();

    return result;
};


var getModelAttribute = function(attrs) {
    var modelAttrNames = ['ngModel', 'model'];

    var keys = Object.keys(attrs);

    var result = null;
    modelAttrNames.some(function(item) {
        var r = keys.indexOf(item) >= 0;
        if(r) {
            result = item;
        }
        return r;
    });

    return result;
};


function capitalize(s)
{
    return s && s[0].toUpperCase() + s.slice(1);
}

// TODO We need to expand prefixed values if the termtype is IRI

/**
 *
 * @param oneWay If true, the model is not updated on rexContext changes for the respective coordinate
 *
 */
var createCompileComponent = function($rexComponent$, $component$, $parse, oneWay) {

    var tag = '[' + $component$ + ']';

    return {
        pre: function(scope, ele, attrs, ctrls) {

            //if($component$ != 'deleted') { return; }

            var modelExprStr = attrs[$rexComponent$];
            var modelGetter = $parse(modelExprStr);
            var modelSetter = modelGetter.assign;

            if(!oneWay) {
                syncAttr($parse, scope, attrs, $rexComponent$);
            }

            var contextCtrl = ctrls[0];

            // ngModel is optionally referenced for dirty checking
            var ngModel = ctrls[2];

            var slot = contextCtrl.allocSlot();
            slot.entry = {};

            scope.$on('$destroy', function() {
                slot.release();
                unsetDirty();
            });


            // Immediately set the initial coordinate and set the model value
            // If we don't do it now we will lose any present model values should the coordinate change
            {
                slot.entry.key = createCoordinate(scope, $component$);
                var value = modelGetter(scope);
                if(value) {
                    setValueAt(contextCtrl.getOverride(), slot.entry.key, value);
                }
            }


            var setDirty = function() {
                var coordinate = slot.entry.key;
                //console.log('>> DIRTY   : ' + coordinate);

                var dirty = scope.rexContext.dirty;
                var dirtySlotIds = dirty[coordinate] = dirty[coordinate] || {};
                dirtySlotIds[slot.id] = true;
            };

            var unsetDirty = function(coordinate) {
                coordinate = coordinate || slot.entry.key;
                //console.log('>> PRISTINE: ' + coordinate);

                var dirty = scope.rexContext.dirty;
                var dirtySlotIds = dirty[coordinate];
                if(dirtySlotIds) {
                    delete dirtySlotIds[slot.id];

                    //console.log('>> PRISTINE SLOT: ' + coordinate + ' [' + slot.id + ']');

                    if(Object.keys(dirtySlotIds).length === 0) {
                        delete dirty[coordinate];

                        //console.log('>> PRISTINE COORD: ' + coordinate);
                    }
                }
            };

            /**
             * This is a bit hacky:
             *
             * The deleted attribute is always transferred when the coordinate changes
             *
             */
            var checkDirty = function(coordinate) {
                var result;
                if($component$ === 'deleted') {
                    result = true;
                } else {

                    coordinate = coordinate || slot.entry.key;
                    var dirty = scope.rexContext.dirty;
                    var dirtySlotIds = dirty[coordinate];
                    result = !!dirtySlotIds;
                }
                return result;
            };



            // If there is a model, take the pristine state into account
            if(ngModel) {
                var updateDirtyState = function() {
                    if(ngModel.$pristine) {
                        unsetDirty();
                    } else {
                        setDirty();
                    }
                };

                scope.$watch(updateDirtyState);
            }

            // If the coordinate changes AND the target is not dirty,
            // we copy the value at the override's old coordinate to the new coordinate
            // This way we ensure we are not overwriting a user's input
            // Otherwise (if the model is pristine), just set the model to the value of the current base data
            scope.$watch(function() {
                var r = createCoordinate(scope, $component$);
                return r;
            }, function(newCoordinate, oldCoordinate) {

                // TODO This handler often gets called even if the coordinates actually equal - can we optimize it?
                if(newCoordinate && !newCoordinate.equals(oldCoordinate)) {
                    //console.log('>> Coordinate change from [' + oldCoordinate + '] to ' + ' [' + newCoordinate + ']');

                    // Check the dirty state at the old coordinate
                    var isDirty = checkDirty(oldCoordinate);

                    // Inform the context about the current coordinate we are referring to
                    // TODO: If we did slot.setCoordinate(newCoordinate) then the context could immediately perform actions
                    slot.entry.key = newCoordinate;

                    var value = isDirty
                        ? getEffectiveValue(scope.rexContext, oldCoordinate)
                        : getEffectiveValue(scope.rexContext, newCoordinate)
                        ;

                    //console.log('## Watch 1: Transferring value [' + value + '] from coordinate [' + oldCoordinate + '] to [' + newCoordinate + ']');
                    setValueAt(contextCtrl.getOverride(), newCoordinate, value);

                    //console.log('>> UNDIRTY : ' + oldCoordinate);
                    unsetDirty(oldCoordinate);
                }
            }, true);


            // If the effective value at a coordinate changes, set the model to that value
            if(!oneWay) {
                scope.$watch(function() {
                    var coordinate = slot.entry.key;
                    var r = getEffectiveValue(scope.rexContext, coordinate);
                    return r;

                }, function(value) {
                    var coordinate = slot.entry.key;

                    if(modelSetter) {
                        //console.log('## Watch 2: Setting model value [' + value + '] from coordinate [' + coordinate + ']');
                        modelSetter(scope, value);
                    }

                }, true);
            }

            // If the model value changes, set the value in the override
            // at that coordinate to reflect this
            scope.$watch(function() {
                var r = modelGetter(scope);
                return r;
            }, function(value) {
                var coordinate = slot.entry.key;

                //console.log('## Watch 3: Setting shadow value [' + value + '] at coordinate [' + coordinate + ']');
                setValueAt(contextCtrl.getOverride(), coordinate, value);

            }, true);

        }

    };
};

var assembleTalisRdfJson = function(map) {
    //console.log('Assembling talis rdf json');
    var result = {};

    var entries = map.entries();

    entries.forEach(function(entry) {
        var coordinate = entry.key;

        var check = new Coordinate(
            coordinate.s,
            coordinate.p,
            coordinate.i,
            'deleted'
        );

        var isDeleted = map.get(check);

        if(!isDeleted) {
            var str = entry.val;

            var s = result;
            var p = s[coordinate.s] = s[coordinate.s] || {};
            var x = p[coordinate.p] = p[coordinate.p] || [];
            var o = x[coordinate.i] = x[coordinate.i] || {};

            o[coordinate.c] = str;
        } else {
            //console.log('<< DELETED: ' + coordinate);
        }
    });



    return result;
};

/**
 * In place processing of prefixes in a Talis RDF JSON structure.
 *
 * If objects have a prefixMapping attribute, value and datatype fields
 * are expanded appropriately.
 *
 */
var processPrefixes = function(talisRdfJson, prefixMapping) {
    var result = {};

    var sMap = talisRdfJson;
    var ss = Object.keys(sMap);
    ss.forEach(function(s) {
        var pMap = sMap[s];
        var ps = Object.keys(pMap);

        ps.forEach(function(p) {
           var iArr = pMap[p];

           iArr.forEach(function(cMap) {
               //var pm = cMap.prefixMapping;
               var pm = prefixMapping;

               if(pm) {
                   if(cMap.type === 'uri') {
                       var val = cMap.value;
                       cMap.value = pm.expandPrefix(val);
                   } else if(cMap.type === 'literal' && cMap.datatype != null) {
                       var datatype = cMap.datatype;

                       cMap.datatype = pm.expandPrefix(datatype);
                   }

                   //delete cMap['prefixMapping'];
               }
           });
        });
    });

    return result;
};


//var __defaultPrefixMapping = new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext);


//var createCoordinate = function(scope, component) {
//    var pm = scope.rexPrefixMapping || new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext);
//
//    return new Coordinate(
//        pm.expandPrefix(scope.rexSubject),
//        pm.expandPrefix(scope.rexPredicate),
//        scope.rexObject,
//        component
//    );
//};

var createCoordinate = function(scope, component) {
    return new Coordinate(
        scope.rexSubject,
        scope.rexPredicate,
        scope.rexObject,
        component
    );
};


//var _array = {
//    create: function() {
//        return [];
//    },
//    put: function(arr, index, value) {
//        data[index] = value;
//    },
//    get: function(arr, index) {
//        return data[index];
//    },
//    remove: function(arr, index) {
//        arr.splice(index, 1);
//    }
//};
//
//var _obj = {
//    create: function() {
//        return {};
//    },
//    put: function(obj, key, value) {
//        obj[key] = value;
//    },
//    get: function(obj, key) {
//        return obj[key];
//    },
//    remove: function(arr, key) {
//        delete obj[key];
//    }
//};
//
//var rdfSchema = [{
//    id: 's',
//    type: _obj
//}, {
//    id: 'p'
//    type: _obj
//}, {
//    id: 'i',
//    type: _array
//}, {
//    id: 'c',
//    type: _obj
//}
//];
//
//var NestedMap = jassa.ext.Class.create({
//    /**
//     * schema: []
//     */
//    initialize: function(schema) {
//        this.schema = schema;
//    },
//
//    put: function(coordinate, value) {
//
//    },
//
//    get: function(coordinate, value) {
//
//    },
//
//    remove: function(coordinate) {
//
//    }
//})


var talisRdfJsonToEntries = function(talisRdfJson) {
    var result = [];

    var sMap = talisRdfJson;
    var ss = Object.keys(sMap);
    ss.forEach(function(s) {
        var pMap = sMap[s];
        var ps = Object.keys(pMap);

        ps.forEach(function(p) {
           var iArr = pMap[p];

           //for(var i = 0; i < iArr.length; ++i) {
           var i = 0;
           iArr.forEach(function(cMap) {
               var cs = Object.keys(cMap);

               cs.forEach(function(c) {
                   var val = cMap[c];

                   var coordinate = new Coordinate(s, p, i, c);

                   result.push({
                       key: coordinate,
                       val: val
                   });
               });
               ++i;
           });

        });

    });

    return result;
};



// Returns the object array at a given predicate
var getObjectsAt = function(talisRdfJson, coordinate) {
    var s = coordinate ? talisRdfJson[coordinate.s] : null;
    var result = s ? s[coordinate.p] : null;
    return result;
};

// Returns the object at a given index
var getObjectAt = function(talisRdfJson, coordinate) {
    var p = getObjectsAt(talisRdfJson, coordinate);
    var result = p ? p[coordinate.i] : null;

    return result;
};

var getOrCreateObjectAt = function(talisRdfJson, coordinate, obj) {
    var s = talisRdfJson[coordinate.s] = talisRdfJson[coordinate.s] || {};
    var p = s[coordinate.p] = s[coordinate.p] || [];
    var result = p[coordinate.i] = p[coordinate.i] || obj || {};
    return result;
};

/* Dangerous: splicing breaks references by index
var removeObjectAt = function(talisRdfJson, coordinate) {
    var s = talisRdfJson[coordinate.s];
    var p = s ? s[coordinate.p] : null;
    //var i = p ? p[coordinate.i] : null;

    if(p) {
        p.splice(coordinate.i, 1);

        if(p.length === 0) {
            delete s[coordinate.p];
        }
    }
};
*/

var compactTrailingNulls = function(arr) {
    while(arr.length && arr[arr.length-1] == null){
        arr.pop();
    }
};

var removeValueAt = function(talisRdfJson, coordinate) {

    var ps = talisRdfJson[coordinate.s];
    var is = ps ? ps[coordinate.p] : null;
    var cs = is ? is[coordinate.i] : null;

    if(cs) {
        delete cs[coordinate.c];

        if(Object.keys(cs).length === 0) {

            delete is[coordinate.i];
            compactTrailingNulls(is);

            if(is.length === 0) {
                delete ps[coordinate.p];

                if(Object.keys(ps).length === 0) {
                    delete talisRdfJson[coordinate.s];
                }
            }
        }
    }
};

var setValueAt = function(talisRdfJson, coordinate, value) {
    //if(value != null) {
    if(coordinate != null) {
        var o = getOrCreateObjectAt(talisRdfJson, coordinate);
        o[coordinate.c] = value;
    //}
    }
};

// TODO Rename to getComponentAt
var getValueAt = function(talisRdfJson, coordinate) {
    var i = getObjectAt(talisRdfJson, coordinate);
    var result = i ? i[coordinate.c] : null;

    return result;
};


var diff = function(before, after) {
    var result = new jassa.util.HashSet();

    after.forEach(function(item) {
        var isContained = before.contains(item);
        if(!isContained) {
            result.add(item);
        }
    });

    return result;
};


var setDiff = function(before, after) {

    var result = {
        added: diff(before, after),
        removed: diff(after, before)
    };

    return result;
};

var getEffectiveValue = function(rexContext, coordinate) {
    //var result = rexContext.override ? rexContext.override.get(coordinate) : null;
    var result = rexContext.override ? getValueAt(rexContext.override, coordinate) : null;

    if(result == null) {
        result = rexContext.json ? getValueAt(rexContext.json, coordinate) : null;
    }

    return result;
};


/**
 * One way binding of the value of an attribute into scope
 * (possibly via a transformation function)
 *
 */
var syncAttr = function($parse, $scope, attrs, attrName, deep, transformFn) {
    var attr = attrs[attrName];
    var getterFn = $parse(attr);

    var getEffectiveValue = function() {
        var v = getterFn($scope);
        var r = transformFn ? transformFn(v) : v;
        return r;
    };

    $scope.$watch(getEffectiveValue, function(v) {
        $scope[attrName] = v;
    }, deep);

    var result = getEffectiveValue();
    // Also init the value immediately
    $scope[attrName] = result;

    return result;
};


var setEleAttrDefaultValue = function(ele, attrs, attrName, defaultValue) {
    var result = ele.attr(attrName);
    if(!result) { // includes empty string
        result = defaultValue;
        ele.attr(attrName, result);

        var an = attrs.$normalize(attrName);
        attrs[an] = result;
    }
    return result;
};






// TODO Create a util for id allocation

// NOTE: We should make a rex module only for the annotations without the widgets, so that the annotations would not depend on ui.select
angular.module('ui.jassa.rex', ['dddi', 'ui.select']);

//var basePriority = 0;

angular.module('ui.jassa.rex')


.directive('rexContext', ['$parse', '$q', '$dddi', function($parse, $q, $dddi) {
    return {
        priority: 30,
        restrict: 'A',
        scope: true,
        require: 'rexContext',
        controller: ['$scope', function($scope) {

            $scope.rexContext = $scope.rexContext || {};

            this.$scope = $scope;

            //this.rexContext = $scope.rexContext;
            this.getOverride = function() {
                //return $scope.override;
                var rexContext = $scope.rexContext;
                var r = rexContext ? rexContext.override : null;
                return r;
            };


            // Attribute where child directives can register changes
            //this.rexChangeScopes = $scope.rexChangeScopes = [];

            // Arrays where child directives can register slots where
            // they publish their change
            this.nextSlot = 0;
            $scope.rexChangeSlots = {};


            this.allocSlot = function() {
                var tmp = this.nextSlot++;
                var id = 'slot_' + tmp;

                //var self = this;

                //console.log('[SLOT]: Allocated ' + id);

                var result = $scope.rexChangeSlots[id] = {
                    id: id,
                    release: function() {
                        //console.log('[SLOT]: Released ' + id);
                        delete $scope.rexChangeSlots[id];

                        //console.log('[SLOT]: In Use ' + Object.keys(self.rexChangeSlots).length);
                    }
                };

                return result;
            };

            this.getSlots = function() {
                var slots = $scope.rexChangeSlots;
                var slotIds = Object.keys(slots);

                var result = slotIds.map(function(slotId) {
                    var slot = slots[slotId];
                    return slot;
                });

                return result;
            };

            // Iterate all slots and create a graph from all .triples attributes
            this.getEnforcedGraph = function() {
                var result = new jassa.rdf.GraphImpl();
                var slots = this.getSlots();
                slots.forEach(function(slot) {
                    var triples = slot.triples;

                    if(triples) {
                        result.addAll(triples);
                    }
                });

                return result;
            };

            // Iterate all slots and collect referenced coordinates
            this.getReferencedCoordinates = function() {
                var result = new jassa.util.HashSet();

                var slots = this.getSlots();
                slots.forEach(function(slot) {
                    var entry = slot.entry;

                    var coordinate = entry ? entry.key : null;
                    if(coordinate != null) {
                        result.add(coordinate);
                    }
                });

                return result;
            };

//            this.releaseSlot = function(slot) {
//                delete this.changeSlots[slot.id];
//            }

        }],

        compile: function(ele, attrs) {

            setEleAttrDefaultValue(ele, attrs, 'rex-context', 'rexContext');

            return {
                pre: function(scope, ele, attrs, ctrl) {


                    // If no context object is provided, we create a new one
//                    if(!attrs.rexContext) {
//                        scope.rexContextAnonymous = {};
//                        //attrs.rexContext = 'rexContextAnonymous';
//                    }

                    syncAttr($parse, scope, attrs, 'rexContext');


                    var initContext = function(rexContext) {
                        rexContext.override = rexContext.override || {};//  new jassa.util.HashMap();

                        // a map from coordinate to slotId to true
                        rexContext.dirty = rexContext.dirty || {};


                        rexContext.refSubjects = rexContext.refSubjects || {}; // a map from subject to reference count. Filled out by rexSubject.

                        rexContext.srcGraph = rexContext.srcGraph || new jassa.rdf.GraphImpl();


                        /**
                         * Resets the form by iterating over all referenced coordinates
                         * and setting the override to the corresponding values from the base graph
                         */
                        rexContext.reset = function() {

                            var r = updateSubjectGraphs().then(function() {

                                // TODO Reload all data for referenced resources
                                // This essentially means that rexSubject has to registered referenced resources here...

                                var coordinates = ctrl.getReferencedCoordinates();

                                coordinates.forEach(function(coordinate) {
                                    var currentValue = getEffectiveValue(rexContext, coordinate);
                                    var originalValue = getValueAt(rexContext.json, coordinate);
                                    setValueAt(rexContext.override, coordinate, originalValue);
                                    //console.log('Resetting ' + coordinate + ' from [' + currentValue + '] to [' + originalValue + ']');
                                });

                                return true;
                            });

                            r = $q.when(r);

                            return r;
                        };

                    };

                    var updateArray = function(arrFn) {
                        var result = [];

                        return function() {
                            var items = arrFn();

                            while(result.length) { result.pop(); }

                            result.push.apply(result, items);

                            return result;
                        };
                    };

                   var getSubjects = updateArray(function() {
                       var r = Object.keys(scope.rexContext.refSubjects);
                       //console.log('Subjects:' + JSON.stringify(r));
                       return r;
                   });

                   var updateSubjectGraphs = function() {
                       var lookupEnabled = scope.rexLookup;
                       var sparqlService = scope.rexSparqlService;
                       var subjectStrs = scope.rexContext.subjects;

                       var r;

                       if(lookupEnabled && sparqlService && subjectStrs) {
                           var subjects = subjectStrs.map(function(str) {
                               return jassa.rdf.NodeFactory.createUri(str);
                           });

                           var lookupService = new jassa.service.LookupServiceGraphSparql(sparqlService);

                           var promise = lookupService.lookup(subjects);

                           r = promise.then(function(subjectToGraph) {
                               var contextScope = scope.rexContext;
                               var baseGraph = contextScope.baseGraph = contextScope.baseGraph || new jassa.rdf.GraphImpl();

                               subjectToGraph.forEach(function(graph, subject) {
                                   // Remove prior data from the graph
                                   var pattern = new jassa.rdf.Triple(subject, null, null);
                                   baseGraph.removeMatch(pattern);

                                   baseGraph.addAll(graph);
                               });

                               // Add the updated data
                               // TODO Add the data to the context
                           });
                       } else {
                           r = Promise.resolve();
                       }

                       r = r.then(function() {
                           var rexContext = scope.rexContext;
                           rexContext.json = rexContext.baseGraph ? jassa.io.TalisRdfJsonUtils.triplesToTalisRdfJson(rexContext.baseGraph) : {};
                       });

                       return r;
                   };


                    scope.$watchCollection('[rexSparqlService, rexLookup, rexPrefixMapping]', function() {
                        $q.when(updateSubjectGraphs());
                    });

                    scope.$watchCollection(getSubjects, function(subjects) {
                        scope.rexContext.subjects = subjects;

                        console.log('Subjects: ' + JSON.stringify(subjects));
                        $q.when(updateSubjectGraphs());
                    });


                    // Make sure to initialize any provided context object
                    // TODO: The status should probably be part of the context directive, rather than a context object
                    scope.$watch(function() {
                        return scope.rexContext;
                    }, function(newVal) {
                        initContext(newVal);
                    });

                    initContext(scope.rexContext);

                    var getBaseGraph = function() {
                        var rexContext = scope.rexContext;
                        var r = rexContext ? rexContext.baseGraph : null;
                        return r;
                    };

                    // Synchronize the talis json structure with the graph
                    // TODO Performance-bottleneck: Synchronize via an event API on the Graph object rather than using Angular's watch mechanism
                    scope.$watch(function() {
                        var baseGraph = getBaseGraph();
                        var r = baseGraph ? baseGraph.hashCode() : null;
                        return r;
                    }, function() {
                        var baseGraph = getBaseGraph();
                        scope.rexContext.json = baseGraph ? jassa.io.TalisRdfJsonUtils.triplesToTalisRdfJson(baseGraph) : {};
                    });

                    var createDataMap = function(coordinates) {

                        var override = ctrl.getOverride();

                        var result = new jassa.util.HashMap();
                        coordinates.forEach(function(coordinate) {
                            var val = getEffectiveValue(scope.rexContext, coordinate);
                            result.put(coordinate, val);
                        });

                        return result;
                    };

                    var dataMapToGraph = function(dataMap, prefixMapping) {
                        var talis = assembleTalisRdfJson(dataMap);
                        processPrefixes(talis, prefixMapping);

                        // Update the final RDF graph
                        var result = jassa.io.TalisRdfJsonUtils.talisRdfJsonToGraph(talis);
                        return result;
                    };

                    // Update the referenced sub graph
                    var createRefGraph = function() {
                        var result = new jassa.rdf.GraphImpl();
                        var coordinates = ctrl.getReferencedCoordinates();

                        var srcJson = scope.rexContext.json;

                        coordinates.forEach(function(coordinate) {
                            var obj = getObjectAt(srcJson, coordinate);
                            if(obj != null) {
                                var o = jassa.rdf.NodeFactory.createFromTalisRdfJson(obj);

                                var s = jassa.rdf.NodeFactory.createUri(coordinate.s);
                                var p = jassa.rdf.NodeFactory.createUri(coordinate.p);

                                var t = new jassa.rdf.Triple(s, p, o);
                                result.add(t);
                            }
                        });

                        return result;
                    };



                    var cleanupReferences = function(coordinateSet) {
                        //console.log('Referenced coordinates', JSON.stringify(coordinates));

                        var override = ctrl.getOverride();
                        var entries = talisRdfJsonToEntries(override);

                        entries.forEach(function(entry) {
                            var coordinate = entry.key;
                            var isContained = coordinateSet.contains(coordinate);
                            if(!isContained) {
                                removeValueAt(override, coordinate);
                            }
                        });
                    };


                    var currentCoordinateSet = new jassa.util.HashSet();

                    // TODO The following two $watch's have linear complexity but
                    // could be optimized if we managed references in a more
                    // clever way

                    // TODO Remove unreferenced values from the override
                    scope.$watch(function() {
                        currentCoordinateSet = ctrl.getReferencedCoordinates();

                        var r = currentCoordinateSet.hashCode();
                        //console.log('coordinateSetHash: ', r);
                        return r;
                    }, function() {
                        //console.log('Override', scope.rexContext.override);
                        cleanupReferences(currentCoordinateSet);
                    }, true);


                    var dddi = $dddi(scope);

                    scope.currentDataMap = new jassa.util.HashMap();

                    dddi.register('currentDataMap', function() {
                        var r = createDataMap(currentCoordinateSet);

                        r = r.hashCode() === scope.currentDataMap.hashCode()
                            ? scope.currentDataMap
                            : r;

                        return r;
                    });

                    dddi.register('rexContext.graph', ['currentDataMap.hashCode()', function() {
                        var r = dataMapToGraph(scope.currentDataMap, scope.rexContext.prefixMapping);

                        var enforcedGraph = ctrl.getEnforcedGraph();
                        // TODO Remove from enforcedGraph those triples that are already present in the source data
                        //enforcedGraph.removeAll();
                        r.addAll(enforcedGraph);

                        return r;
                    }]);

                    dddi.register('rexContext.targetJson', ['rexContext.graph.hashCode()',
                        function() {
                            var r = jassa.io.TalisRdfJsonUtils.triplesToTalisRdfJson(scope.rexContext.graph);
                            return r;
                        }]);

                    dddi.register('rexContext.srcGraph',
                        function() {
                            var r = createRefGraph();

                            r = r.hashCode() === scope.rexContext.srcGraph.hashCode()
                                ? scope.rexContext.srcGraph
                                : r;

                            return r;
                        });

                    dddi.register('rexContext.diff', ['rexContext.srcGraph.hashCode()', 'rexContext.graph.hashCode()',
                        function() {
                            var r = setDiff(scope.rexContext.srcGraph, scope.rexContext.graph);
                            return r;
                        }]);

                }
            };
        }
    };
}])

;


/*
var hashCodeArr = function(arr) {
    var result = 0;
    var l = arr ? arr.length : 0;
    for (var i = 0; i < l; i++) {
        var item = arr[i];
        var hashCode = item.hashCode ? item.hashCode : 127;
        result = result * 31 + hashCode;
        res = res & res;
    }

    return result;
};
*/


/*
var getComponentValueForNode = function(node, component) {
    var json = jassa.rdf.NodeUtils.toTalisRdfJson(node);
    var result = json[compononte];
    return result;
};

// A hacky function that iterates the graph
getValue: function(graph, coordinate) {

}
*/


// TODO Watch any present sourceGraph attribute
// And create the talis-json structure

// The issue is, that the source graph might become quite large
// (e.g. consider storing a whole DBpedia Data ID in it)
// Would it be sufficient to only convert the subset of the graph
// to RDF which is referenced by the form?

//scope.$watch(function() {
//    return scope.rexSourceGraph;
//}, function(sourceGraph) {
//    scope.rexJson = jassa.io.TalisRdfJsonUtils.triplesToTalisRdfJson(sourceGraph);
//}, true);


// Remove all entries from map that exist in base
//var mapDifference = function(map, baseFn) {
//    var mapEntries = map.entries();
//    mapEntries.forEach(function(mapEntry) {
//        var mapKey = mapEntry.key;
//        var mapVal = mapEntry.val;
//
//        var baseVal = baseFn(mapKey);
//
//        if(jassa.util.ObjectUtils.isEqual(mapVal, baseVal)) {
//            map.remove(mapKey);
//        }
//    });
//};


/*
rexContext.remove = rexContext.remove || function(coordinate) {
    // Removes an object
    var objs = getObjectsAt(rexContext.json, coordinate);
    if(objs) {
        objs.splice(coordinate.i, 1);
    }

    objs = getObjectsAt(rexContext.override, coordinate);
    if(objs) {
        objs.splice(coordinate.i, 1);
    }
};
*/

/*
rexContext.setObject = function(s, p, i, sourceObj) {
    var coordinate = new Coordinate(s, p, i);
    var targetObj = getOrCreateObjectAt(rexContext.override, coordinate);
    angular.copy(sourceObj, targetObj);
    //setObjectAt(rexContext.override, coordinate, value) {
};
*/
/* TODO I think it is not used anymore, but code left here for reference
rexContext.addObject = function(_s, _p, sourceObj) {
    var pm = scope.rexPrefixMapping || new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext);
    //__defaultPrefixMapping;

    var s = pm.expandPrefix(_s);
    var p = pm.expandPrefix(_p);

    var coordinate = new Coordinate(s, p);

    var as = getObjectsAt(rexContext.json, coordinate);
    var bs = getObjectsAt(rexContext.override, coordinate);

    var a = as ? as.length : 0;
    var b = bs ? bs.length : 0;

    var i = Math.max(a, b);

    var c = new Coordinate(s, p, i);

    var targetObj = getOrCreateObjectAt(rexContext.override, c);
    angular.copy(sourceObj, targetObj);
    //setObjectAt(rexContext.override, coordinate, value) {
};
*/
//var override = scope.rexContext.override;
//console.log('Override', JSON.stringify(scope.rexContext.override.entries()));
//var combined = new jassa.util.HashMap();
//console.log('Coordinates: ', JSON.stringify(coordinates));
//var map = new MapUnion([scope.rexContext.override, scope.rex]);
//console.log('DATA', result.entries());


angular.module('ui.jassa.rex')

.directive('rexDatatype', ['$parse', function($parse) {
    return {
        priority: 7,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject', '?ngModel'],
        controller: angular.noop,
        compile: function(scope, ele, attrs, ctrls) {
            return createCompileComponent('rexDatatype', 'datatype', $parse);
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Directive to mark triples as deleted
 *
 */
.directive('rexDeleted', ['$parse', function($parse) {
    return {
        priority: 7,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject', '?ngModel'],
        controller: angular.noop,
        compile: function(ele, attrs) {
            return createCompileComponent('rexDeleted', 'deleted', $parse);
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Convenience directive
 *
 * rexObjectIri="model"
 *
 * implies rex-object rex-termtype="iri" rex-value="model"
 */
.directive('rexIri', ['$parse', '$compile', function($parse, $compile) {
    return {
        priority: 900, //+ 1000,
        restrict: 'A',
        scope: true,
        terminal: true,
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var modelExprStr = ele.attr('rex-iri');

                    if(jassa.util.ObjectUtils.isEmptyString(modelExprStr)) {
                        var name = getModelAttribute(attrs);
                        modelExprStr = attrs[name];
                    }

                    if(!modelExprStr) {
                        throw new Error('No model provided and found');
                    }


                    ele.removeAttr('rex-iri');

                    ele.attr('rex-object', ''); //'objectIriObject');
                    ele.attr('rex-termtype', '"uri"');
                    ele.attr('rex-value', modelExprStr);

                    // Continue processing any further directives
                    $compile(ele)(scope);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexLang', ['$parse', function($parse) {
    return {
        priority: 7,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject', '?ngModel'],
        controller: angular.noop,
        compile: function(scope, ele, attrs, ctrls) {
            return createCompileComponent('rexLang', 'lang', $parse);
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexLiteral', ['$parse', '$compile', function($parse, $compile) {
    return {
        priority: 900,
        restrict: 'A',
        scope: true,
        terminal: true,
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var modelExprStr = ele.attr('rex-literal');

                    if(jassa.util.ObjectUtils.isEmptyString(modelExprStr)) {
                        var name = getModelAttribute(attrs);
                        modelExprStr = attrs[name];
                    }

                    if(!modelExprStr) {
                        throw new Error('No model provided and found');
                    }

                    ele.removeAttr('rex-literal');

                    // TODO: Do not overwrite rex-object if already present

                    ele.attr('rex-object', ''); //'objectIriObject');
                    ele.attr('rex-termtype', '"literal"');
                    ele.attr('rex-value', modelExprStr);

                    // Continue processing any further directives
                    $compile(ele)(scope);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Directive to attach a rex lookup function to the scope
 *
 * Different lookup functions can be used at different HTML regions under a rex-context.
 *
 * If present, rex-subject will use the provided function to perform data lookups
 * on its IRIs and store the content in the scope
 *
 */
.directive('rexLookup', ['$parse', function($parse) {
    return {
        priority: 26,
        restrict: 'A',
        scope: true,
        require: '^rexContext',
        controller: angular.noop,
        //require: ['^?rexSubject', '^?rexObject']
//        controller: ['$scope', function($scope) {
//        }],
        compile: function(ele, attrs){
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    syncAttr($parse, scope, attrs, 'rexLookup');
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * TODO rex-results may be conceptually a much cleaner approach - deprecated/remove this directive if it proofs true
 *
 *
 * Directive to refer to the set of URIs at a target
 *
 * rexNavTargets="arrayOfTargetIriStrings"
 *
 *
 *
 * Requires:
 * - rex-subject on any ancestor
 * - rex-nav-predicate present on the same element as rex-nav-targets
 *
 * Optional:
 * - rex-nav-inverse Whether to navigate the given predicate in inverse direction\
 *
 */
.directive('rexNavTargets', ['$parse', '$q', '$dddi', function($parse, $q, $dddi) {
    return {
        priority: 10,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexSubject'],
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {

                    var contextCtrl = ctrls[0];

                    var slot = contextCtrl.allocSlot();
                    slot.triples = [];
                    //slot.entry = {};

                    scope.$on('$destroy', function() {
                        slot.release();
                    });



                    syncAttr($parse, scope, attrs, 'rexNavPredicate');
                    syncAttr($parse, scope, attrs, 'rexNavInverse');


                    var targetModelStr = ele.attr('rex-nav-targets');
                    var dddi = $dddi(scope);

                    dddi.register(targetModelStr, ['rexSparqlService', 'rexSubject', 'rexNavPredicate', '?rexNavInverse',
                        function(sparqlService, subjectStr, predicateStr, isInverse) {

                            var pm = scope.rexPrefixMapping || new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext);

                            subjectStr = pm.expandPrefix(subjectStr);
                            predicateStr = pm.expandPrefix(predicateStr);

                            //var path = new jassa.facete.Path([new jassa.facete.Step(propertyStr, isInverse)]);

                            var s = jassa.sparql.VarUtils.s;
                            var p = jassa.rdf.NodeFactory.createUri(predicateStr);
                            //var o = jassa.sparql.VarUtils.o;
                            var o = jassa.rdf.NodeFactory.createUri(subjectStr);

                            var triple = isInverse
                                ? new jassa.rdf.Triple(s, p, o)
                                : new jassa.rdf.Triple(o, p, s)
                                ;

                            var concept = new jassa.sparql.Concept(
                                new jassa.sparql.ElementGroup([
                                    new jassa.sparql.ElementTriplesBlock([triple]),
                                    new jassa.sparql.ElementFilter(new jassa.sparql.E_IsIri(new jassa.sparql.ExprVar(s)))
                                ]), s);

                            var query = jassa.sparql.ConceptUtils.createQueryList(concept);

                            var listService = new jassa.service.ListServiceSparqlQuery(sparqlService, query, concept.getVar());

                            var task = listService.fetchItems().then(function(entries) {
                                var r = entries.map(function(item) {
                                    var s = item.key.getUri();
                                    return s;
                                });

                                return r;
                            });

                            return task;
                    }]);


                    var updateRelation = function(array) {
                        // Convert the array to triples

                        var pm = scope.rexPrefixMapping || new jassa.rdf.PrefixMappingImpl(jassa.vocab.InitialContext);

                        var s = jassa.rdf.NodeFactory.createUri(pm.expandPrefix(scope.rexSubject));
                        var p = jassa.rdf.NodeFactory.createUri(pm.expandPrefix(scope.rexNavPredicate));

                        var triples = array.map(function(item) {
                            var o = jassa.rdf.NodeFactory.createUri(pm.expandPrefix(item));
                            var r = scope.rexNavInverse
                                ? new jassa.rdf.Triple(o, p, s)
                                : new jassa.rdf.Triple(s, p, o)
                                ;

                            return r;
                        });

                        // TODO: We must check whether that triple already exists, and if it does not, insert it
                        //jassa.io.TalisRdfJsonUtils.triplesToTalisRdfJson(triples, scope.rexContext.override);

                        // Notify the context about the triples which we require to exist
                        slot.triples = triples;
                    };

                    // TODO Check for changes in the target array, and update
                    // relations as needed

                    // ISSUE: We need to ensure that each IRI in the array has the appropriate relation to
                    // the source resource of the navigation
                    scope.$watchCollection(targetModelStr, function(array) {
                        if(array) {
                            updateRelation(array);
                        }
                    });

                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 *
 * rexObject takes an index to reference an object in a (conceptual) array under a given subject and predicate
 *
 * Hm, no, I still think we can do better: There are different ways to refer to a specific object:
 * - by index (the 3nd item under leipzig -> rdfs:label (possibly of a certain datatype and lang)
 * - by value (i am referring to the triple having leipzig -> population -> 500000)
 *   yet, we could generalize a value reference  to an index reference:
 *      the first object satisfying "leipzig -> population -> {value: 500000 }"
 *
 * So long story short: this directive references an item in regard to a set of filters.
 *
 *
 * TODO Update below
 *
 * Note that this directive only creates a context for setting components
 * (term type, value, datatype and language tag) of an object -
 * it does not create an rdf.Node object directly.
 *
 * rex-object="{}" // someObject
 * The argument is optional.
 *
 * If one is provided, it is as a reference to an object being built, otherwise
 * a new object is allocated.
 * The provided object is registered at the object for the
 * corresponding predicate and subject in the context where it is used.
 *
 * Note that this means that in principle several triples being built could reference
 * the state of the same object (even if they are built using different rex-contexts).
 */
.directive('rexObject', ['$parse', function($parse) {
    return {
        priority: 13,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexPredicate'],
        controller: angular.noop,
        compile: function(ele, attrs) {

//            var modelExprStr = ele.attr('rex-object');
//            if(!modelExprStr) {
//                ele.attr('rex-object')
//            }
//
//            // TODO Raise an error if rex-predicate exists on this element
//            //if(ele.attr)
//
//            ele.removeAttr('rex-typeof');
//
//            ele.attr('rex-predicate', '"http://www.w3.org/1999/02/22-rdf-syntax-ns#type"');
//            ele.attr('rex-iri', modelExprStr);


            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var predicateCtrl = ctrls[1];
                    var contextCtrl = ctrls[0];

                    var i = predicateCtrl.rexObjectScopes.length;
                    if(!attrs['rexObject']) {
                        attrs['rexObject'] = '' + i;
                    }


                    //console.log('FOOO', attrs);

//console.log('rexObject index: ' + i);
                    predicateCtrl.rexObjectScopes.push(scope);

                    syncAttr($parse, scope, attrs, 'rexObject');

//                    scope.$watch('rexObject', function(newVal) {
//                        console.log('rexObject is: ', newVal, typeof newVal);
//                    })

                    scope.$on('$destroy', function() {
                        jassa.util.ArrayUtils.removeItemStrict(predicateCtrl.rexObjectScopes, scope);
                    });



                    // If rexObject is present, we also create a rexRef attribute
                    var rexRef = function() {
                        var result = {
                            s: scope.rexSubject,
                            p: scope.rexPredicate,
                            i: scope.rexObject
                        };

                        return result;
                    };

                    scope.$watch(function() {
                        var r = rexRef();
                        return r;
                    }, function(newRef) {
                        scope.rexRef = newRef;
                    }, true);

                    scope.rexRef = rexRef();


                    // Below stuff is deprecated
                    // Make the prefixes part of the Talis RDF json object
                    //var cc = createCompileComponent('rexPrefixMapping', 'prefixMapping', $parse, true);
                    //cc.pre(scope, ele, attrs, ctrls);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexPredicate', ['$parse', function($parse) {
    return {
        priority: 17,
        restrict: 'A',
        scope: true,
        //require: ['^?rexSubject', '^?rexObject']
        controller: ['$scope', function($scope) {
            this.rexObjectScopes = $scope.rexObjectScopes = [];
        }],
        compile: function(ele, attrs){
            return {
                pre: function(scope, ele, attrs, ctrls) {

                    // Sync rex-predicate to its resolved value
                    syncAttr($parse, scope, attrs, 'rexPredicate', false, function(predicate) {
                        var pm = scope.rexPrefixMapping;
                        var r = pm ? pm.expandPrefix(predicate) : predicate;
                        return r;
                    });

                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Prefixes
 *
 * prefixes must be declared together with the context and cannot be nested
 *
 */
.directive('rexPrefix', ['$parse', function($parse) {
    return {
        priority: 19,
        restrict: 'A',
        scope: true,
        //require: '^rexContext',
        require: 'rexContext',
        controller: ['$scope', function($scope) {
            $scope.rexPrefix = $scope.rexPrefix || {};
        }],
        compile: function(ele, attrs) {

            setEleAttrDefaultValue(ele, attrs, 'rex-prefix', 'rexPrefix');

            return {
                pre: function(scope, ele, attrs, ctrls) {

                    var processPrefixDecls = function(val) {
                        // Set up a prototype chain to an existing
                        // prefix mapping
                        var parentRexPrefix = scope.$parent.rexPrefix;
                        var parentPrefixes = parentRexPrefix ? parentRexPrefix.prefixes : jassa.vocab.InitialContext;

                        var result;
                        if(parentPrefixes) {
                            result = Object.create(parentPrefixes);
                        } else {
                            result = {};
                        }

                        var obj = jassa.util.PrefixUtils.parsePrefixDecls(val);
                        angular.extend(result, obj);
//                        var keys = Object.keys(obj);
//                        keys.forEach(function(key) {
//                            result[key] = obj[key];
//                        });

                        return result;
                    };

                    syncAttr($parse, scope, attrs, 'rexPrefix', true, processPrefixDecls);

                    // TODO We may need to watch scope.$parent.rexPrefix as well

                    var updatePrefixMapping = function() {
//                        for(var key in scope.rexPrefix) {
//                            console.log('GOT: ', key);
//                        }

                        scope.rexPrefixMapping = new jassa.rdf.PrefixMappingImpl(scope.rexPrefix);

                        scope.rexContext.prefixMapping = scope.rexPrefixMapping;
                    };

                    // Update the prefixMapping when the prefixes change
                    scope.$watchGroup([function() {
                        return scope.rexPrefix;
                    }, function() {
                        return scope.rexContext;
                    }],
                    function(rexPrefix) {
                        updatePrefixMapping();
                    }, true);

                    updatePrefixMapping();
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexSparqlService', ['$parse', function($parse) {
    return {
        priority: 30,
        restrict: 'A',
        scope: true,
        controller: angular.noop,
        compile: function(ele, attrs){
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    syncAttr($parse, scope, attrs, 'rexSparqlService');
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * rexSubject only registers the referenced subject at the rexContext.
 *
 * This way, the context knows what data needs to be re-fetched in case of a full reset (e.g. after an edit).
 *
 */
.directive('rexSubject', ['$parse', '$q', function($parse, $q) {
    return {
        priority: 24,
        restrict: 'A',
        scope: true,
        require: '^rexContext',
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, contextCtrl) {
                    syncAttr($parse, scope, attrs, 'rexSubject', false, function(subject) {
                        var pm = scope.rexPrefixMapping;
                        var r = pm ? pm.expandPrefix(subject) : subject;
                        return r;
                    });

                    scope.$on('destroy', function() {
                        var contextScope = contextCtrl.$scope.rexContext;
                        jassa.util.ObjectUtils.free(contextScope.refSubjects, scope.rexSubject);
                    });


                    var updateRegistration = function(now, old) {
                        var contextScope = contextCtrl.$scope.rexContext;
                        jassa.util.ObjectUtils.alloc(contextScope.refSubjects, now);
                        jassa.util.ObjectUtils.free(contextScope.refSubjects, old);
                    };

                    updateRegistration(scope.rexSubject);
                    scope.$watch('rexSubject', updateRegistration);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * TODO: Actually we should just implement this as a convenience directive which replaces itself with
 * rex-termtype rex-value rex-lang and rex-datatype
 * This way we wouldn't have to make the book keeping more complex than it already is
 *
 * rexTerm synchronizes a model which is interpreted as an object in a talis RDF json and
 * thus provides the fields 'type', 'value', 'datatype' and 'lang'.
 *
 * <rdf-term-input ng-model="model" rex-term="model"></rdf-term-input>
 *
 * If rex-term appears on a directive using a model attribute   , it can be shortened as shown below:
 *
 * <rdf-term-input ng-model="model" rex-term></rdf-term-input>
 *
 *
 */
.directive('rexTerm', ['$parse', '$compile', function($parse, $compile) {
    return {
        priority: 900,
        restrict: 'A',
        scope: true,
        terminal: true,
        //require: ['^rexContext', '^rexObject', '?^ngModel'],
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var modelExprStr = attrs.rexTerm;

                    if(jassa.util.ObjectUtils.isEmptyString(modelExprStr)) {
                        var name = getModelAttribute(attrs);
                        modelExprStr = attrs[name];
                    }

                    if(!modelExprStr) {
                        throw new Error('No model provided and found');
                    }

                    ele.removeAttr('rex-term');

                    ele.attr('rex-termtype', modelExprStr + '.type');
                    ele.attr('rex-datatype', modelExprStr + '.datatype');
                    ele.attr('rex-lang', modelExprStr + '.lang');
                    ele.attr('rex-value', modelExprStr + '.value');

                    // Continue processing any further directives
                    $compile(ele)(scope);
                }
            };
        }
    };
}])

;


angular.module('ui.jassa.rex')

.directive('rexTermtype', ['$parse', function($parse) {
    return {
        priority: 10,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject', '?ngModel'],
        controller: angular.noop,
        compile: function(ele, attrs) {
            return createCompileComponent('rexTermtype', 'type', $parse);
        }
    };
}])

;

angular.module('ui.jassa.rex')

/**
 * Convenience directive
 *
 * implies rex-prediacte="rdf:type" rex-iri
 *
 * !! Important: because rex-predicate is implied, this directive cannot be used on a directive
 * that already hase rex-predicate defined !!
 */
.directive('rexTypeof', ['$parse', '$compile', function($parse, $compile) {
    return {
        priority: 1000,
        restrict: 'A',
        scope: true,
        terminal: true,
        controller: angular.noop,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var modelExprStr = ele.attr('rex-typeof');

                    // TODO Raise an error if rex-predicate exists on this element
                    //if(ele.attr)

                    ele.removeAttr('rex-typeof');

                    ele.attr('rex-predicate', '"http://www.w3.org/1999/02/22-rdf-syntax-ns#type"');
                    ele.attr('rex-iri', modelExprStr);

                    // Continue processing any further directives
                    $compile(ele)(scope);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.rex')

.directive('rexValue', ['$parse', function($parse) {
    return {
        priority: 4,
        restrict: 'A',
        scope: true,
        require: ['^rexContext', '^rexObject', '?ngModel'],
        controller: angular.noop,
        compile: function(ele, attrs) {
            return createCompileComponent('rexValue', 'value', $parse);
        }
    };
}])

;


// Updates a target model based on transformation whenever the source changes
var syncHelper = function(scope, attrs, $parse, $interpolate, sourceAttr, targetAttr, fnAttr, conditionAttr, iterpolateSource) {

    // TODO Instead of $interpolate we could actually use attrs.$observe()

    var sourceExprStr = attrs[sourceAttr];
    var sourceGetter = iterpolateSource ? $interpolate(sourceExprStr) : $parse(sourceExprStr);

    var targetExprStr = attrs[targetAttr];
    var targetGetter = $parse(targetExprStr);
    var targetSetter = targetGetter.assign;

    var fnExprStr = attrs[fnAttr];
    var fnGetter = $parse(fnExprStr);

    var identity = function(x) {
        return x;
    };


    var conditionExprStr = attrs[conditionAttr];
    var conditionGetter = $parse(conditionExprStr);

    var checkCondition = function() {
        var tmp = conditionGetter(scope);
        var result = angular.isUndefined(tmp) ? true : tmp;
        return result;
    };

    var doSync = function() {
        var isConditionSatisfied = checkCondition();
        if(isConditionSatisfied) {
            var sourceValue = sourceGetter(scope);
            var fn = fnGetter(scope) || identity;
            var v = fn(sourceValue);
            targetSetter(scope, v);
        }
    };

    // If the condition changes to 'true', resync the models
    scope.$watch(function() {
        var r = checkCondition();
        return r;
    }, function(isConditionSatisfied) {
        if(isConditionSatisfied) {
            doSync();
        }
    }); // Condition should be boolean - no need for deep watch

    scope.$watch(function() {
        var r = fnGetter(scope);
        return r;
    }, function(newFn) {
        if(newFn) {
            doSync();
        }
    }); // Functions are compared by reference - no need to deep watch

    scope.$watch(function() {
        var r = sourceGetter(scope);
        return r;
    }, function(sourceValue) {
        doSync();
    }, true);

};

angular.module('ui.jassa.sync', []);

angular.module('ui.jassa.sync')

/**
 * Convenience directive
 *
 * sync-template="templateStr"
 *
 * implies sync-source="templateStr" sync-interpolate sync-to-target? sync-target?
 *
 * if sync-target is not specified, it will try to detect a target based on model attribute names (e.g. ngModel)
 */
.directive('syncTemplate', ['$parse', '$compile', function($parse, $compile) {
    return {
        priority: 1000,
        restrict: 'A',
        scope: true,
        terminal: true,
        controller: function() {},
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    var templateStr = ele.attr('sync-template');

                    ele.removeAttr('sync-template');

                    ele.attr('sync-source', templateStr);
                    ele.attr('sync-source-interpolate', '');

                    if(ele.attr('sync-target') == null) {
                        var name = getModelAttribute(attrs);
                        var modelExprStr = attrs[name];

                        if(!modelExprStr) {
                            throw new Error('No model provided and found');
                        }

                        ele.attr('sync-target', modelExprStr);
                    }

                    // TODO Create a function to set attr default values
                    if(ele.attr('sync-to-target') == null) {
                        ele.attr('sync-to-target', '');
                    }

                    // Continue processing any further directives
                    $compile(ele)(scope);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.sync')

.directive('syncToSource', ['$parse', '$interpolate', function($parse, $interpolate) {
    return {
        priority: 390,
        restrict: 'A',
        //scope: true,
        controller: function() {},
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {
                    syncHelper(scope, attrs, $parse, $interpolate, 'syncTarget', 'syncSource', 'syncToSource', 'syncToSourceCond', false);
                }
            };
        }
    };
}])

;


angular.module('ui.jassa.sync')

// sync-to-target="toString"
.directive('syncToTarget', ['$parse', '$interpolate', function($parse, $interpolate) {
    return {
        priority: 390,
        restrict: 'A',
        //scope: true,
        controller: function() {},
        compile: function(ele, attrs) {
            return {
                pre: function(scope, ele, attrs, ctrls) {

                    var interpolateSource = 'syncSourceInterpolate' in attrs;

                    syncHelper(scope, attrs, $parse, $interpolate, 'syncSource', 'syncTarget', 'syncToTarget', 'syncToTargetCond', interpolateSource);
                }
            };
        }
    };
}])

;
