/*
 * jassa-ui-angular
 * https://github.com/GeoKnow/Jassa-UI-Angular

 * Version: 0.9.0-SNAPSHOT - 2015-03-25
 * License: MIT
 */
angular.module("ui.jassa", ["ui.jassa.auto-focus","ui.jassa.blurify","ui.jassa.breadcrumb","ui.jassa.compile","ui.jassa.constraint-list","ui.jassa.dataset-browser","ui.jassa.facet-list","ui.jassa.facet-tree","ui.jassa.facet-typeahead","ui.jassa.facet-value-list","ui.jassa.jassa-list","ui.jassa.jassa-list-browser","ui.jassa.jassa-media-list","ui.jassa.lang-select","ui.jassa.list-search","ui.jassa.paging-model","ui.jassa.paging-style","ui.jassa.pointer-events-scroll-fix","ui.jassa.replace","ui.jassa.resizable","ui.jassa.scroll-glue-right","ui.jassa.sparql-grid","ui.jassa.template-list"]);
angular.module('ui.jassa.auto-focus', [])

// Source: http://stackoverflow.com/questions/14833326/how-to-set-focus-on-input-field
.directive('autoFocus', function($timeout, $parse) {
    return {
        link: function(scope, element, attrs) {
            var model = $parse(attrs.autoFocus);
            scope.$watch(model, function(value) {
                if(value === true) {
                    $timeout(function() {
                         element[0].focus();
                    });
                }
            });
            // to address @blesh's comment, set attribute value to 'false'
            // on blur event:
            element.bind('blur', function() {
                if(model.assign) {
                    scope.$apply(model.assign(scope, false));
                }
            });
        }
    };
})

;


angular.module('ui.jassa.blurify', [])

/**
 * Replaces text content with an alternative on blur
 * blurify="(function(model) { return 'displayValue'; })"
 *
 */
.directive('blurify', [ '$parse', function($parse) {
    return {
        require: 'ngModel',
        restrict: 'A',
        link: function($scope, element, attrs, model) {
            element.on('focus', function () {
                // Re-render the model on focus
                model.$render();
            });
            element.on('blur', function () {
                var modelVal = $parse(attrs['ngModel'])($scope);
                var labelFn = $parse(attrs['blurify'])($scope);

                if(labelFn) {
                    var val = labelFn(modelVal);
                    if(val && val.then) {
                        val.then(function(label) {
                            element.val(label);
                        });
                    } else {
                        element.val(val);
                    }
                }
//              $scope.$apply(function() {
//                  model.$setViewValue(val);
//              });
            });
        }
    };
}])

;


angular.module('ui.jassa.breadcrumb', [])


/**
 * Controller for the SPARQL based FacetTree
 * Supports nested incoming and outgoing properties
 *
 */
.controller('BreadcrumbCtrl', ['$rootScope', '$scope', '$q', '$timeout', function($rootScope, $scope, $q, $timeout) {

    $scope.slots = [];

    $scope.invert = function() {
        $scope.model.property = null;

        var pathHead = $scope.model.pathHead;
        if(pathHead) {
            $scope.model.pathHead = new jassa.facete.PathHead(pathHead.getPath(), !pathHead.isInverse());
        }
    };

    var update = function() {
        var propertyName = $scope.model.property;
        var property = (propertyName == null || propertyName === true) ? null : jassa.rdf.NodeFactory.createUri(propertyName);

        var pathHead = $scope.model.pathHead;
        var path = pathHead ? pathHead.getPath() : null;

        var ls = $scope.lookupService;

        if(ls && path) {
            var steps = path.getSteps();

            //var ls = jassa.sponate.LookupServiceUtils.createLookupServiceNodeLabels(sparqlService);

            // Value
            ls = new jassa.service.LookupServiceTransform(ls, function(val) { return val.displayLabel; });
            //ls = new jassa.service.LookupServicePathLabels(ls);

            var uris = jassa.facete.PathUtils.getUris(path);

            if(property != null) {
                uris.push(property);
            }

            $q.when(ls.lookup(uris)).then(function(map) {

                var slots = steps.map(function(step) {
                    var node = jassa.rdf.NodeFactory.createUri(step.getPropertyName());
                    var r = {
                        property: node,
                        labelInfo: {
                            displayLabel: map.get(node),
                        },
                        isInverse: step.isInverse()
                    };

                    return r;
                });

                var value = null;
                if(property) {
                    value = {
                        property: property,
                        labelInfo: {
                            displayLabel: map.get(property)
                        }
                    };
                }

                var r = {
                    slots: slots,
                    value: value
                };

                return r;
            }).then(function(state) {
                $scope.state = state;
            });

        }

    };

    $scope.$watch('[ObjectUtils.hashCode(facetTreeConfig), model.pathHead.hashCode(), model.property]', function() {
        update();
    }, true);

    $scope.$watch('lookupService', function() {
        update();
    });



//    var pathToItems = function() {
//
//    };


    // TODO Add a function that splits the path according to maxSize

    /*
    var updateVisiblePath = function() {
        var path = $scope.path;
        if(path) {
            var l = path.getLength();
            var maxSize = $scope.maxSize == null ? l : $scope.maxSize;

            //console.log('offset: ' + $scope.offset);
            $scope.offset = Math.max(0, l - maxSize);
            $scope.visiblePath = $scope.maxSize ? path : new facete.Path(path.steps.slice($scope.offset));
        } else {
            $scope.offset = 0;
            $scope.visiblePath = null;
        }
    }
    */

//    $scope.$watch(function() {
//        var model = $scope.model;
//        var r = 0;
//        if(model) {
//            r = model.pathHead ? model.pathHead.hashCode() : 0;
//            r += jassa.util.ObjectUtils.hashCodeStr(model.property);
//        }
//        return r;
//    }, function() {
//        updateVisiblePath();
//    });


//    $scope.$watch(function() {
//        return $scope.maxSize;
//    }, function() {
//        updateVisiblePath();
//    });



//    $scope.selectIncoming = function(path) {
//        if($scope.facetTreeConfig) {
//            var pathToDirection = $scope.facetTreeConfig.getFacetTreeState().getPathToDirection();
//            pathToDirection.put(path, -1);
//
//        }
//    };
//
//    $scope.selectOutgoing = function(path) {
//        if($scope.facetTreeConfig) {
//            var pathToDirection = $scope.facetTreeConfig.getFacetTreeState().getPathToDirection();
//            pathToDirection.put(path, 1);
//
//        }
//    };

//    $scope.isEqual = function(a, b) {
//        var r = a == null ? b == null : a.equals(b);
//        return r;
//    };


    $scope.setPath = function(index) {
        $scope.model.property = null;

        var pathHead = $scope.model.pathHead;
        var path = pathHead ? pathHead.getPath() : null;
        var isInverse = pathHead ? pathHead.isInverse() : false;
        if(path != null) {
            var steps = path.getSteps();
            var newSteps = steps.slice(0, index);

            var newPath = new jassa.facete.Path(newSteps);
            $scope.model.pathHead = new jassa.facete.PathHead(newPath, isInverse);
        }
    };

//    $scope.selectPath = function(path) {
//        $scope.path = path;
//        //alert(path);
//    };
    //
}])

/**
 * The actual dependencies are:
 * - sparqlServiceFactory
 * - facetTreeConfig
 * - labelMap (maybe this should be part of the facetTreeConfig)
 */
.directive('breadcrumb', function() {
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'template/breadcrumb/breadcrumb.html',
        scope: {
            //sparqlService: '=',
            lookupService: '=',
            model: '=ngModel',
            maxSize: '=?',
            onSelect: '&select'
        },
        controller: 'BreadcrumbCtrl',
        compile: function(elm, attrs) {
            return {
                pre: function(scope, elm, attrs, controller) {
                }
            };
//            return function link(scope, elm, attrs, controller) {
//            };
        }
    };
})

;

angular.module('ui.jassa.compile', [])

/**
 * Source
 * http://stackoverflow.com/questions/17417607/angular-ng-bind-html-unsafe-and-directive-within-it
 */
.directive('compile', ['$compile', function($compile) {
    return {
        scope: true,
        terminal: true,
        replace: true,
        compile: function(elem, attrs) {
            return {
                post: function(scope, elem, attrs, controller) {
                    scope.$watch(function(scope) {
                        // watch the 'compile' expression for changes
                        return scope.$eval(attrs.compile);
                    }, function(value) {
                        // when the 'compile' expression changes
                        // assign it into the current DOM
                        elem.html(value);

                        // compile the new DOM and link it to the current
                        // scope.
                        // NOTE: we only compile .childNodes so that
                        // we don't get into infinite loop compiling ourselves
                        $compile(elem.contents())(scope);
                    });
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.constraint-list', [])

.controller('ConstraintListCtrl', ['$scope', '$q', '$rootScope', '$dddi', function($scope, $q, $rootScope, $dddi) {

    var dddi = $dddi($scope);

    dddi.register('constraintLabelsLookupService', ['lookupService',
        function(lookupService) {
            var r = new jassa.facete.LookupServiceConstraintLabels(ls);
            return r;
        }]);

    dddi.register('constraints', ['=constraintManager.getConstraints()',
        function(constraints) {
            return constraints;
        }]);

    dddi.register('listService', ['constraints', 'constraintLabelsLookupService', function() {

    }]);

    var refresh = function() {

        if($scope.constraintLabelsLookupService) {

            var constraints = $scope.constraintManager ? $scope.constraintManager.getConstraints() : [];
            var promise = $scope.constraintLabelsLookupService.lookup(constraints);

            //$q.when(promise).then(function(map) {
            $q.when(promise).then(function(map) {

                var items =_(constraints).map(function(constraint) {
                    var label = map.get(constraint);

                    var r = {
                        constraint: constraint,
                        label: label
                    };

                    return r;
                });

                $scope.constraints = items;
            }, function(e) {
                throw e;
            });
        }
    };

    $scope.removeConstraint = function(item) {
        $scope.constraintManager.removeConstraint(item.constraint);
    };

}])


/**
 * The actual dependencies are:
 * - sparqlServiceFactory
 * - facetTreeConfig
 * - labelMap (maybe this should be part of the facetTreeConfig)
 */
.directive('constraintList', function() {
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'template/constraint-list/constraint-list.html',
        transclude: false,
        require: 'constraintList',
        scope: {
            lookupService: '=',
            constraintManager: '=',
            onSelect: '&select'
        },
        controller: 'ConstraintListCtrl'
    };
})

;

//angular.module('DatasetBrowser', ['ui.jassa', 'ui.bootstrap', 'ui.sortable', 'ui.keypress', 'ngSanitize'])
angular.module('ui.jassa.dataset-browser', ['ui.jassa.replace'])

.controller('DatasetBrowserCtrl', ['$scope', '$q', function($scope, $q) {

    var createListService = function(sparqlService, langs) {

        /*
         * Set up the Sponate mapping for the data we are interested in
         */
        var store = new jassa.sponate.StoreFacade(sparqlService, {
            'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            'dbpedia-owl': 'http://dbpedia.org/ontology/',
            'foaf': 'http://xmlns.com/foaf/0.1/',
            'dcat': 'http://www.w3.org/ns/dcat#',
            'theme': 'http://example.org/resource/theme/',
            'o': 'http://example.org/ontology/'
        });

        var labelTemplateFn = function() { return jassa.sponate.MappedConceptUtils.createMappedConceptLiteralPreference(new jassa.sparql.LiteralPreference(langs)); };
        var commentTemplateFn = function() { return jassa.sponate.MappedConceptUtils.createMappedConceptLiteralPreference(new jassa.sparql.LiteralPreference(langs, [jassa.vocab.rdfs.comment])); };

        var template = [{
            id: '?s',
            label: { $ref: { target: labelTemplateFn, attr: 'displayLabel' }},
            comment: { $ref: { target: commentTemplateFn, attr: 'displayLabel' }},
            depiction: '?d',
            resources: [{
                label: '"Distributions"',
                type: '"dataset"',
                items: [{ $ref: { target: 'distributions', on: '?x'} }],
                template: 'template/dataset-browser/distribution-list.html'
            }, {
                label: '"Join Summaries"',
                type: 'join-summary',
                items: [[{ $ref: { target: 'datasets', on: '?j'} }], function(items) { // <- here be recursion
                    var r = _(items).chain().map(function(item) {
                                return item.resources[0].items;
                            }).flatten(true).value();
                    return r;
                }],
                template: 'template/dataset-browser/distribution-list.html'
            }]
        }];

        store.addMap({
            name: 'primaryDatasets',
            template: template,
            from: '?s a dcat:Dataset ; dcat:theme theme:primary . Optional { ?s foaf:depiction ?d } . Optional { ?x o:distributionOf ?s } Optional { ?j o:joinSummaryOf ?s }'
        });

        store.addMap({
            name: 'datasets',
            template: template,
            from: '?s a dcat:Dataset . Optional { ?s foaf:depiction ?d } . Optional { ?x o:distributionOf ?s } Optional { ?j o:joinSummaryOf ?s }'
        });

        store.addMap({
            name: 'distributions',
            template: [{
                id: '?s',
                accessUrl: '?a',
                graphs: ['?g']
            }],
            from: '?s a dcat:Distribution ; dcat:accessURL ?a . Optional { ?s o:graph ?g } '
        });


        var result = store.primaryDatasets.getListService();

        result = new jassa.service.ListServiceTransformConceptMode(result, function() {
            var searchConfig = new jassa.sparql.LiteralPreference(langs, [jassa.vocab.rdfs.comment, jassa.vocab.rdfs.label]);
            var labelRelation = jassa.sparql.LabelUtils.createRelationLiteralPreference(searchConfig);
            return labelRelation;
        });

        result.fetchItems().then(function(entries) {
            console.log('Got: ', entries);
        });

        return result;
    };


    $scope.$watch(function() {
        return $scope.sparqlService;
    }, function(sparqlService) {
        $scope.listService = createListService(sparqlService, $scope.langs);
    });


    $scope.langs = ['de', 'en', ''];

    /*
     * Create a list service for our mapping and decorate it with
     * keyword search support
     */
    $scope.searchModes = [{
        label: 'regex',
        mode: 'regex'
    }, {
        label: 'fulltext',
        mode: 'fulltext'
    }];

    $scope.activeSearchMode = $scope.searchModes[0];

    /*
     * Angular setup
     */
    $scope.availableLangs = ['de', 'en', 'jp', 'ko'];


    $scope.offset = 0;
    $scope.limit = 10;
    $scope.totalItems = 0;
    $scope.items = [];
    $scope.maxSize = 7;

    $scope.doFilter = function(searchString) {
        $scope.filter = {
            searchString: searchString,
            mode: $scope.activeSearchMode.mode
        };
        $scope.offset = 0;
    };

    /*
    var buildAccessUrl = function(accessUrl, graphUrls) {
        var defaultQuery = 'Select * { ?s ?p ?o } Limit 10'
        return accessUrl + '?qtxt=' + encodeURIComponent(defaultQuery) + (
            graphUrls && graphUrls.length > 0
                ? '&' + graphUrls.map(function(item) { return 'default-graph-uri=' + encodeURIComponent(item); }).join('&')
                : ''
        );
    }
    */

    $scope.context = {
        onSelect: function() {
            //console.log('onSelect called', arguments);
            $scope.onSelect.apply(this, arguments);
        }
    };

//    $scope.context = {
//        // TODO Get rid of the limitation of having to pass in the itemTemplate via a 'context' object
//        itemTemplate: 'template/dataset-browser/dataset-list-item.html'
//    };

    //$scope.itemTemplate = 'dataset-item.html';
    $scope.itemTemplate = 'template/dataset-browser/dataset-list-item.html';
}])

.directive('datasetBrowser', function() {
    return {
        restrict: 'EA',
        replace: true,
        //templateUrl: 'template/dataset-browser/dataset-list.html',
        templateUrl: 'template/dataset-browser/dataset-browser.html',
        scope: {
            sparqlService: '=',
            //model: '=ngModel',
            maxSize: '=?',
            onSelect: '&?'
        },
        controller: 'DatasetBrowserCtrl',
        compile: function(elm, attrs) {
            return {
                pre: function(scope, elm, attrs, controller) {
                }
            };
//            return function link(scope, elm, attrs, controller) {
//            };
        }
    };
})



;

angular.module('ui.jassa.facet-list', ['ui.jassa.breadcrumb', 'ui.jassa.paging-style', 'ui.jassa.paging-model', 'ui.bootstrap', 'dddi']) // ui.bootstrap for paginator


/**
 * Controller for the SPARQL based FacetTree
 * Supports nested incoming and outgoing properties
 *
 */
.controller('FacetListCtrl', ['$rootScope', '$scope', '$q', '$dddi', function($rootScope, $scope, $q, $dddi) {

    // TODO Rename plugins to facetPlugins
    // Alternatively, plugins could be tagged to which type they apply
    $scope.facetPlugins = $scope.facetPlugins || [];
    $scope.showConstraints = false;

    var listServiceWatcher = new ListServiceWatcher($scope, $q);

    $scope.ls = listServiceWatcher.watch('listService');

    $scope.pagingStyle = $scope.pagingStyle || {};
    $scope.ObjectUtils = jassa.util.ObjectUtils;
    $scope.loading = $scope.loading || {data: false, pageCount: false};
    $scope.NodeUtils = jassa.rdf.NodeUtils;
    $scope.breadcrumb = $scope.breadcrumb || {};

    $scope.location = null;



    // Maps to track the filters set for the facets, facet values and the constraints
    $scope.locationToFilter = new jassa.util.HashMap();


    var modes = {
        constraint: {
            type: 'constraint',
            itemTemplate: 'template/facet-list/facet-list-item-constraint.html',
            listServiceFn: function() {
                var r = $scope.constraintService;
                return r;
            }
        },
        facet: {
            type: 'facet',
            itemTemplate: 'template/facet-list/facet-list-item-facet.html',
            listServiceFn: function() {
                var r = ( $scope.facetService
                    ? $scope.facetService.prepareListService($scope.breadcrumb.pathHead)
                    : null );

                return r;
            }
        },
        facetValue: {
            type: 'facetValue',
            itemTemplate: 'template/facet-list/facet-list-item-facet-value.html',
            listServiceFn: function() {
                var r = ( $scope.facetValueService
                    ? $scope.facetValueService.prepareTableService($scope.facetValuePath, true)
                    : null );

                return r;
            }
        }
    };



    /*
    $scope.pathToFilter = new jassa.util.HashMap();
    $scope.pathHeadToFilter = new jassa.util.HashMap();
    $scope.constraintFilter = {}; //new jassa.util.HashMap();
    */


    var defs = {
        pathHead: new jassa.facete.PathHead(new jassa.facete.Path()),
        property: null
    };

    _.defaults($scope.breadcrumb, defs);



    // This property is derived from the values of $scope.facetValueProperty
    $scope.facetValuePath = null;


    /*
     * Actions
     */

    /**
     * Moves to the sub-facets via a property
     */
    $scope.descendFacet = function(property) {
        var pathHead = $scope.breadcrumb.pathHead;

        var newStep = new jassa.facete.Step(property.getUri(), pathHead.isInverse());
        var newPath = pathHead.getPath().copyAppendStep(newStep);
        $scope.breadcrumb.pathHead = new jassa.facete.PathHead(newPath, pathHead.isInverse());
    };


    /**
     * Creates a path object by appending a property to a pathHead
     */
    var appendProperty = function(pathHead, propertyName) {
        var result = pathHead.getPath().copyAppendStep(new jassa.facete.Step(propertyName, pathHead.isInverse()));
        return result;
    };


    /*
    var updateFacetService = function() {
        if($scope.facetService) {
            $q.when($scope.facetService.prepareListService($scope.breadcrumb.pathHead)).then(function(listService) {
                $scope.listService = listService;
            });
        }
    };

    var updateFacetValueService = function() {
        if($scope.facetValueService) {
            $q.when($scope.facetValueService.prepareTableService($scope.facetValuePath, true)).then(function(listService) {
                $scope.listService = listService;
            });
        }
    };
    */

    $scope.toggleConstraint = function(node) {
        var path = $scope.facetValuePath;
        var constraintManager = $scope.constraintManager;

        var constraint = new jassa.facete.ConstraintEquals(path, node);

        // TODO Integrate a toggle constraint method into the filterManager
        constraintManager.toggleConstraint(constraint);
    };

    /*
     * Refresh
     */

    /*
    var update = function() {
        var promise = $scope.mode.listServiceFn();
        $q.when(promise).then(function(listService) {
            $scope.listService = listService;
        })
    }
    */
    /*
    var update = function() {
        if($scope.facetValuePath == null) {
            updateFacetService();
        } else {
            updateFacetValueService();
        }
    };
    */

    /*
     * DDDI
     */

    var dddi = $dddi($scope);

    dddi.register('mode', ['=showConstraints', '=breadcrumb', function(showConstraints, breadcrumb) {
        var r;
        if(showConstraints === true) {
            r = modes['constraint'];
        } else {
            var property = breadcrumb.property;

            if(property === true) { // facet values for the empty facet
                r = modes['facetValue'];
            } else {
                r = property == null ? modes['facet'] : modes['facetValue'];
            }
        }
        return r;
    }]);

    dddi.register('facetValuePath', ['=breadcrumb', // property may be null, but breadcrumb must exist
        function(breadcrumb) {
            var property = breadcrumb.property;

            var r;
            if(property === true) {
                r = $scope.breadcrumb.pathHead.getPath();
            } else {
                r = property == null ? null : appendProperty($scope.breadcrumb.pathHead, property);
            }
            return r;
        }]);

    dddi.register('location', ['mode', '?=facetValuePath.hashCode()', '?=breadcrumb.pathHead.hashCode()',
        function() {
            var r;
            if($scope.mode.type === 'constraint') {
                r = 'constraint';
            } else {
                r = $scope.facetValuePath != null ? $scope.facetValuePath : $scope.breadcrumb.pathHead;
            }

            return r;
        }]);


    /**
     * Retrieve the filter object for the given location and mode
     */
    dddi.register('listFilter', ['location',
        function(location) {
            var r = $scope.locationToFilter.get($scope.location);
            if(r == null) {
                r = { limit: 10, offset: 0, concept: null };
                $scope.locationToFilter.put($scope.location, r);
            }
            return r;
        }]);

    dddi.register('filterModel', ['listFilter.concept', function(concept) {
        return concept;
    }]);

    dddi.register('ls.ctrl.filter', ['?listFilter',
        function(listFilter) {
            var r = listFilter || $scope.ls.ctrl.filter; // retain the value if the argument is null
            return r;
        }]);


    dddi.register('listService', ['mode', 'location', 'facetService', 'facetValueService', 'constraintService', function(mode) {
        var r = mode.listServiceFn();
        return r;
    }]);

    dddi.register('totalConstraints', ['constraintManager.getConstraints().length', function(r) {
        return r;
    }]);

}])


/**
 * The actual dependencies are:
 * - sparqlServiceFactory
 * - facetTreeConfig
 * - labelMap (maybe this should be part of the facetTreeConfig)
 */
.directive('facetList', function() {
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'template/facet-list/facet-list.html',
        //transclude: false,
        scope: {
            constraintManager: '=',
            lookupServiceNodeLabels: '=',
            facetService: '=',
            facetValueService: '=',
            constraintService: '=',


            //sparqlService: '=',
            //facetTreeConfig: '=',
            //facetConfig: '=',
            listFilter: '=?',
            breadcrumb: '=?uiModel', // The visible facet / facetValue
            pathHead: '=?',
            facetPlugins: '=?',
            pluginContext: '=?', //plugin context
            pagingStyle: '=?',
            loading: '=?',
            onSelect: '&select'
        },
        controller: 'FacetListCtrl',
        compile: function(elm, attrs) {
            return function link(scope, elm, attrs, controller) {
            };
        }
    };
});

angular.module('ui.jassa.facet-tree', [])

/**
 * Controller for the SPARQL based FacetTree
 * Supports nested incoming and outgoing properties
 *
 */
.controller('FacetTreeDirContentCtrl', ['$rootScope', '$scope', '$q', function($rootScope, $scope, $q) {

}])

/**
 * The actual dependencies are:
 * - sparqlServiceFactory
 * - facetTreeConfig
 * - labelMap (maybe this should be part of the facetTreeConfig) 
 */
.directive('facetTreeDirContent', function($parse) {
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'template/facet-tree/facet-tree-content.html',
        transclude: false,
        require: 'facetTree',
        scope: {
            sparqlService: '=',
            facetTreeConfig: '=',
            plugins: '=',
            onSelect: '&select'
        },
        controller: 'FacetTreeDirContentCtrl',
        compile: function(elm, attrs) {
            return function link(scope, elm, attrs, controller) {
            };
        }
    };
})

;

angular.module('ui.jassa.facet-tree', ['ui.jassa.template-list'])

/*
.controller('FacetDirCtrl', ['$scope', function($scope) {
    dirset.offset = dirset.listFilter.getOffset() || 0;
    dirset.limit = dirset.listFilter.getLimit() || 0;
    dirset.pageCount = dirset.limit ? Math.floor(dirset.childCountInfo.count / dirset.limit) : 1;
    dirset.currentPage = dirset.limit ? Math.floor(dirset.offset / dirset.limit) + 1 : 1;
}])
*/

.controller('FacetNodeCtrl', ['$scope', function($scope) {
    $scope.$watchCollection('[facet.incoming, facet.outgoing]', function() {
        var facet = $scope.facet;
        if(facet) {
            $scope.dirset = facet.outgoing ? facet.outgoing : facet.incoming;
        }
    });

    $scope.$watchCollection('[dirset, dirset.listFilter.getOffset(), dirset.listFilter.getLimit(), dirset.childCountInfo.count]', function() {
        var dirset = $scope.dirset;
        if(dirset) {
            dirset.offset = dirset.listFilter.getOffset() || 0;
            dirset.limit = dirset.listFilter.getLimit() || 0;
            dirset.pageCount = dirset.limit ? Math.floor(dirset.childCountInfo.count / dirset.limit) : 1;
            dirset.currentPage = dirset.limit ? Math.floor(dirset.offset / dirset.limit) + 1 : 1;
        }
    });

}])

/**
 * Controller for the SPARQL based FacetTree
 * Supports nested incoming and outgoing properties
 *
 */
.controller('FacetTreeCtrl', ['$rootScope', '$scope', '$q', '$timeout', function($rootScope, $scope, $q, $timeout) {

    var self = this;

    var updateFacetTreeService = function() {
        var isConfigured = $scope.sparqlService && $scope.facetTreeConfig;
        $scope.facetTreeService = isConfigured ? jassa.facete.FacetTreeServiceUtils.createFacetTreeService($scope.sparqlService, $scope.facetTreeConfig) : null;
    };

    var update = function() {
        updateFacetTreeService();
        self.refresh();
    };

    $scope.itemsPerPage = [10, 25, 50, 100];

    $scope.ObjectUtils = jassa.util.ObjectUtils;
    $scope.Math = Math;

    $scope.startPath = null;

    var watchList = '[ObjectUtils.hashCode(facetTreeConfig), startPath]';
    $scope.$watch(watchList, function() {
        //console.log('UpdateTree', $scope.facetTreeConfig);
        update();
    }, true);

    $scope.$watch('sparqlService', function() {
        update();
    });


    $scope.doFilter = function(pathHead, filterString) {
        var pathHeadToFilter = $scope.facetTreeConfig.getFacetTreeState().getPathHeadToFilter();
        var filter = pathHeadToFilter.get(pathHead);
        if(!filter) {
            filter = new jassa.facete.ListFilter(null, 10, 0);
            pathHeadToFilter.put(pathHead, filter);
        }

        filter.setConcept(filterString);
        filter.setOffset(0);


        //getOrCreateState(path).getListFilter().setFilter(filterString);

        //$scope.facetTreeConfig.getPathToFilterString().put(path, filterString);
        //self.refresh();
    };

    self.refresh = function() {

        if($scope.facetTreeService) {
            var promise = $scope.facetTreeService.fetchFacetTree($scope.startPath);
            $q.when(promise).then(function(data) {
                $scope.facet = data;
                //console.log('TREE: ' + JSON.stringify($scope.facet, null, 4));
            });

        } else {
            $scope.facet = null;
        }
    };

    $scope.toggleControls = function(path) {
        var pathToTags = $scope.facetTreeConfig.getPathToTags();
        //tags.showControls = !tags.showControls;
        var tags = pathToTags.get(path);
        if(!tags) {
            tags = {};
            pathToTags.put(path, tags);
        }

        tags.showControls = !tags.showControls;
    };

    $scope.toggleCollapsed = function(path) {
        var pathExpansions = $scope.facetTreeConfig.getFacetTreeState().getPathExpansions();
        jassa.util.CollectionUtils.toggleItem(pathExpansions, path);

        // No need to refresh here, as we are changing the config object
        //self.refresh();
    };

    $scope.isEqual = function(a, b) {
        var r = a == null ? b == null : a.equals(b);
        return r;
    };

    $scope.setStartPath = function(path) {
        //var p = path.getParent();
        //var isRoot = p == null || $scope.isEqual($scope.startPath, p);
        //$scope.startPath = isRoot ? null : p;

        var isRoot = path == null || $scope.isEqual($scope.startPath, path);
        $scope.startPath = isRoot ? null : path;
    };

    $scope.selectIncoming = function(path) {
        if($scope.facetTreeConfig) {
            var pathToDirection = $scope.facetTreeConfig.getFacetTreeState().getPathToDirection();
            pathToDirection.put(path, -1);

            // No need to refresh here, as we are changing the config object
            //self.refresh();
        }
    };

    $scope.selectOutgoing = function(path) {
        if($scope.facetTreeConfig) {
            var pathToDirection = $scope.facetTreeConfig.getFacetTreeState().getPathToDirection();
            pathToDirection.put(path, 1);

            // No need to refresh here, as we are changing the config object
            //self.refresh();
        }
    };


    $scope.selectPage = function(pathHead, page) {
        var pathHeadToFilter = $scope.facetTreeConfig.getFacetTreeState().getPathHeadToFilter();
        var filter = pathHeadToFilter.get(pathHead);
        if(!filter) {
            filter = new jassa.facete.ListFilter(null, 10, 0);
            pathHeadToFilter.put(pathHead, filter);
        }
        var newOffset = (page - 1) * filter.getLimit();
        filter.setOffset(newOffset);
        //console.log('newOffset: ' + newOffset);
    };

}])

/**
 * The actual dependencies are:
 * - sparqlServiceFactory
 * - facetTreeConfig
 * - labelMap (maybe this should be part of the facetTreeConfig)
 */
.directive('facetTree', function() {
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'template/facet-tree/facet-tree-item.html',
        transclude: false,
        require: 'facetTree',
        scope: {
            sparqlService: '=',
            facetTreeConfig: '=',
            plugins: '=',
            pluginContext: '=', //plugin context
            onSelect: '&select'
        },
        controller: 'FacetTreeCtrl',
        compile: function(elm, attrs) {
            return function link(scope, elm, attrs, controller) {
            };
        }
    };
})

;


angular.module('ui.jassa.facet-typeahead', [])

/**
 * facet-typeahead
 *
 */
.directive('facetTypeahead', ['$compile', '$q', '$parse', function($compile, $q, $parse) {

    //var rdf = jassa.rdf;
    var sponate = jassa.sponate;
    var facete = jassa.facete;

    var parsePathSpec = function(pathSpec) {
        var result = pathSpec instanceof facete.Path ? pathSpec : facete.Path.parse(pathSpec);
        return result;
    };

    var makeListService = function(lsSpec, ftac) {
        var result;

        if(!lsSpec) {
            throw new Error('No specification for building a list service provided');
        }
        else if(Object.prototype.toString.call(lsSpec) === '[object String]') {
            var store = ftac.store;

            result = store.getListService(lsSpec);
            if(!result) {
                throw new Error('No collection with name ' + lsSpec + ' found');
            }
        }
        else if(lsSpec instanceof sponate.MappedConcept) {
            var sparqlServiceA = ftac.sparqlService;
            result = jassa.sponate.ListServiceUtils.createListServiceMappedConcept(sparqlServiceA, lsSpec);
        }
        else if(lsSpec instanceof sponate.MappedConceptSource) {
            var mappedConcept = lsSpec.getMappedConcept();
            var sparqlServiceB = lsSpec.getSparqlService();

            result = jassa.sponate.ListServiceUtils.createListServiceMappedConcept(sparqlServiceB, mappedConcept);
        }
        else if(lsSpec instanceof service.ListService) {
            result = lsSpec;
        }
        else {
            throw new Error('Unsupported list service type', lsSpec);
        }

        return result;
    };

    var createConstraints = function(idToModelPathMapping, searchFn, selectionOnly) {

        var result = [];
        var keys = Object.keys(idToModelPathMapping);
        keys.forEach(function(key) {
            var item = idToModelPathMapping[key];
            var scope = item.scope;
            var r;

            var val = item.modelExpr(scope);

            var pathSpec = item.pathExpr(scope);
            var path = parsePathSpec(pathSpec); //facete.PathUtils.

            var valStr;
            if(!selectionOnly && Object.prototype.toString.call(val) === '[object String]' && (valStr = val.trim()) !== '') {

                if(searchFn) {
                    var concept = searchFn(valStr);
                    r = new jassa.facete.ConstraintConcept(path, concept);
                } else {
                    //throw new Error('No keyword search strategy specified');
                    r = new jassa.facete.ConstraintRegex(path, valStr);
                }
            }
            else if(val && val.id) {
                var id = val.id;
                var node = jassa.rdf.NodeFactory.createUri(id);
                r = new jassa.facete.ConstraintEquals(path, node);
            }
            else {
                r = null;
            }

            //console.log('Result constraint: ', r.createElementsAndExprs(config.facetConfig.getRootFacetNode()));

            if(r) {
                result.push(r);
            }
        });

        return result;
    };

    var FacetTypeAheadServiceAngular = function($scope, $q, configExpr, id, listServiceExpr) {
        this.$scope = $scope;
        this.$q = $q;

        this.configExpr = configExpr;
        this.id = id;
        this.listServiceExpr = listServiceExpr;
    };

    FacetTypeAheadServiceAngular.prototype.getSuggestions = function(filterString) {
        var config = this.configExpr(this.$scope);

        //var sparqlService = config.sparqlService;

        // Get the attributes from the config
        var idToModelPathMapping = config.idToModelPathMapping;

        var modelPathMapping = idToModelPathMapping[this.id];

        if(!modelPathMapping) {
            throw new Error('Cannot retrieve model-path mapping for facet-typeahead directive with id ' + id);
        }

        //var limit = modelPathMapping.limit || config.defaultLimit || 10;
        //var offset = modelPathMapping.offset || config.defaultOffset || 0;


        var pathSpec = modelPathMapping.pathExpr(this.$scope);
        var path = parsePathSpec(pathSpec);


        var lsSpec = this.listServiceExpr(this.$scope);
        var listService = makeListService(lsSpec, config);

        // Clone the constraints just for this set of suggestions
/*
        var fc = config.facetConfig;
        var cm = fc.getConstraintManager();
        var cmClone = cm.shallowClone();


        var facetConfig = new facete.FacetConfig();
        facetConfig.setConstraintManager(cmClone);
        facetConfig.setBaseConcept(fc.getBaseConcept());
        facetConfig.setRootFacetNode(fc.getRootFacetNode());
*/

        var facetConfig = config.facetConfig;
        var cmClone = facetConfig.getConstraintManager();

        // Compile constraints
        var constraints = createConstraints(idToModelPathMapping, config.search);

        _(constraints).each(function(constraint) {
            // Remove other constraints on the path
            var paths = constraint.getDeclaredPaths();
            paths.forEach(function(path) {
                var cs = cmClone.getConstraintsByPath(path);
                cs.forEach(function(c) {
                    cmClone.removeConstraint(c);
                });
            });

            cmClone.addConstraint(constraint);
        });

        //console.log('Constraints ', idToModelPathMapping, constraints);

        var facetValueConceptService = new jassa.facete.FacetValueConceptServiceExact(facetConfig);

        var result = facetValueConceptService.prepareConcept(path, false).then(function(concept) {
            //console.log('Path ' + path);
            //console.log('Concept: ' + concept);


            var r = listService.fetchItems(concept, 10).then(function(items) {
                var s = items.map(function(item) {
                    return item.val;
                });

                return s;
            });
            return r;
        });

        return result;

    };


    return {
        restrict: 'A',
        scope: true,
        //require: 'ngModel',
        // We need to run this directive before the the ui-bootstrap's type-ahead directive!
        priority: 1001,

        // Prevent angular calling other directives - we do it manually
        terminal: true,

        compile: function(elem, attrs) {

            if(!this.instanceId) {
                this.instanceId = 0;
            }

            var instanceId = 'facetTypeAhead-' + (this.instanceId++);

            var modelExprStr = attrs['ngModel'];
            var configExprStr = attrs['facetTypeahead'];
            var pathExprStr = attrs['facetTypeaheadPath'];
            var listServiceExprStr = attrs['facetTypeaheadSuggestions'];
            var labelAttr = attrs['facetTypeaheadLabel'];
            var modelAttr = attrs['facetTypeaheadModel'];

            labelAttr = labelAttr || 'id';
            modelAttr = modelAttr || 'id';
            // Add the URI-label directive

            console.log('labelAttr', labelAttr);
            console.log('modelAttr', modelAttr);

            // Remove the attribute to prevent endless loop in compilation
            elem.removeAttr('facet-typeahead');
            elem.removeAttr('facet-typeahead-path');
            elem.removeAttr('facet-typeahead-suggestions');
            elem.removeAttr('facet-typeahead-label');
            elem.removeAttr('facet-typeahead-model');


            //var newAttrVal = 'item.id as item.displayLabel for item in facetTypeAheadService.getSuggestions($viewValue)';
            var tmp = modelAttr ? '.' + modelAttr : '';
            var newAttrVal = 'item as item' + tmp + ' for item in facetTypeAheadService.getSuggestions($viewValue)';
            elem.attr('typeahead', newAttrVal);


            elem.attr('blurify', 'labelFn');

            return {
                pre: function(scope, elem, attrs) {

                    var modelExpr = $parse(modelExprStr);
                    var pathExpr = $parse(pathExprStr);
                    var configExpr = $parse(configExprStr);
                    var listServiceExpr = $parse(listServiceExprStr);

                    scope.labelFn = function(str) {
                        var model = modelExpr(scope);
                        var val = model ? model[labelAttr] : null;
                        var r = val ? val : str;
                        return r;
                    };


                    // Note: We do not need to watch the config, because we retrieve the most
                    // recent values when the suggestions are requested
                    // However, we need to register/unregister the directive from the config object when this changes
                    scope.$watch(configExprStr, function(newConfig, oldConfig) {

                        // Unregister from old config
                        if(oldConfig && oldConfig != newConfig && oldConfig.modelToPathMapping) {
                            delete oldConfig.idToModelPathMapping[instanceId];
                        }

                        if(newConfig) {
                            if(!newConfig.idToModelPathMapping) {
                                newConfig.idToModelPathMapping = {};
                            }

                            newConfig.idToModelPathMapping[instanceId] = {
                                modelExpr: modelExpr,
                                modelExprStr: modelExprStr,
                                pathExprStr: pathExprStr,
                                pathExpr: pathExpr,
                                scope: scope
                            };


                            newConfig.getConstraints = function(selectionOnly) {
                                var result = createConstraints(newConfig.idToModelPathMapping, newConfig.search, selectionOnly);
                                return result;
                            };
                        }
                    });


                    scope.facetTypeAheadService = new FacetTypeAheadServiceAngular(scope, $q, configExpr, instanceId, listServiceExpr);
                },

                post: function(scope, elem, attr) {
                    // Continue processing any further directives
                    $compile(elem)(scope);
                }
            };
        }
    };
}])

;


angular.module('ui.jassa.facet-value-list', [])

/**
 * Controller for the SPARQL based FacetTree
 * Supports nested incoming and outgoing properties
 *
 */
.controller('FacetValueListCtrl', ['$rootScope', '$scope', '$q', function($rootScope, $scope, $q) {

    $scope.filterText = '';

    $scope.pagination = {
        totalItems: 0,
        currentPage: 1,
        maxSize: 5
    };

    $scope.path = null;
    var facetValueService = null;

    var updateFacetValueService = function() {
        var isConfigured = $scope.sparqlService && $scope.facetTreeConfig && $scope.path;

        //facetValueService = isConfigured ? new jassa.facete.FacetValueService($scope.sparqlService, $scope.facetTreeConfig) : null;
        if(isConfigured) {
            var facetConfig = $scope.facetTreeConfig.getFacetConfig();
            facetValueService = new facete.FacetValueService($scope.sparqlService, facetConfig, 5000000);
        }
    };

    var refresh = function() {
        var path = $scope.path;

        if(!facetValueService || !path) {
            $scope.totalItems = 0;
            $scope.facetValues = [];
            return;
        }

        facetValueService.prepareTableService($scope.path, true)
            .then(function(ls) {

                var filter = null;
                var pageSize = 10;
                var offset = ($scope.pagination.currentPage - 1) * pageSize;

                var countPromise = ls.fetchCount(filter);
                var dataPromise = ls.fetchItems(filter, pageSize, offset);

                $q.when(countPromise).then(function(countInfo) {
                    //console.log('countInfo: ', countInfo);

                    $scope.pagination.totalItems = countInfo.count;
                });

                $q.when(dataPromise).then(function(entries) {
                    var items = entries.map(function(entry) {
                        return entry.val;
                    });
                    /*
                    var items = entries.map(function(entry) {
                        var labelInfo = entry.val.labelInfo = {};
                        labelInfo.displayLabel = '' + entry.key;
                        //console.log('entry: ', entry);

                        var path = $scope.path;
                        entry.val.node = entry.key;
                        entry.val.path = path;

                        entry.val.tags = {};

                        return entry.val;
                    });
                    */
                    var cm = $scope.facetTreeConfig.getFacetConfig().getConstraintManager();
                    var cs = cm.getConstraintsByPath(path);
                    var values = {};
                    cs.forEach(function(c) {
                        if(c.getName() === 'equals') {
                            values[c.getValue()] = true;
                        }
                    });

                    items.forEach(function(item) {
                        var isConstrained = values['' + item.node];
                        item.tags = item.tags || {};
                        item.tags.isConstrainedEqual = isConstrained;
                    });

                    $scope.facetValues = items;
                });
            });
    };

    var update = function() {
        updateFacetValueService();
        refresh();
    };

    $scope.ObjectUtils = jassa.util.ObjectUtils;

    var watchList = '[ObjectUtils.hashCode(facetTreeConfig), "" + path, pagination.currentPage]';
    $scope.$watch(watchList, function() {
        update();
    }, true);

    $scope.$watch('sparqlService', function() {
        update();
    });



    $scope.toggleConstraint = function(item) {
        var constraintManager = $scope.facetTreeConfig.getFacetConfig().getConstraintManager();

        var path = $scope.path;
        var node = item.node;
        var constraint = new jassa.facete.ConstraintEquals(path, node);

        // TODO Integrate a toggle constraint method into the filterManager
        constraintManager.toggleConstraint(constraint);
    };

    $scope.filterTable = function(filterText) {
        $scope.filterText = filterText;
        update();
    };


    /*
    $scope.$on('facete:facetSelected', function(ev, path) {

        $scope.currentPage = 1;
        $scope.path = path;

        updateItems();
    });

    $scope.$on('facete:constraintsChanged', function() {
        updateItems();
    });
    */
//  $scope.firstText = '<<';
//  $scope.previousText = '<';
//  $scope.nextText = '>';
//  $scope.lastText = '>>';

}])

/**
 * The actual dependencies are:
 * - sparqlServiceFactory
 * - facetTreeConfig
 * - labelMap (maybe this should be part of the facetTreeConfig)
 */
.directive('facetValueList', function() {
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'template/facet-value-list/facet-value-list.html',
        transclude: false,
        require: 'facetValueList',
        scope: {
            sparqlService: '=',
            facetTreeConfig: '=',
            path: '=',
            onSelect: '&select'
        },
        controller: 'FacetValueListCtrl'
//        compile: function(elm, attrs) {
//            return function link(scope, elm, attrs, controller) {
//            };
//        }
    };
})

;


angular.module('ui.jassa.jassa-list', [])

.controller('JassaListCtrl', ['$scope', '$q', '$timeout', function($scope, $q, $timeout) {

    var defaults = {
        listFilter: {
            concept: null,
            limit: 10,
            offset: 0
        },
        currentPage: 1,
        items: [],
        totalItems: 0,
        maxSize: 7,
        context: {},
        listClass: '',
        paginationOptions: {
            cssClass: 'pagination',
            maxSize: 7,
            rotate: true,
            boundaryLinks: true,
            firstText: '&lt;&lt;',
            previousText: '&lt;',
            nextText: '&gt;',
            lastText: '&gt;&gt;'
        }
    };

    _.defaults($scope, defaults);
    _.defaults($scope.listFilter, defaults.listFilter);
    _.defaults($scope.paginationOptions, defaults.paginationOptions);


    $scope.loading = $scope.loading || { data: false, pageCount: false};
    /*
    $scope.listFilter = $scope.listFilter || { concept: null, limit: 10, offset: 0}; //new jassa.service.ListFilter(null, 10, 0);
    $scope.currentPage = $scope.currentPage || 1;
    $scope.items = $scope.items || [];
    $scope.totalItems = $scope.totalItems || $scope.items.length;
    $scope.maxSize = $scope.maxSize || 7;
    $scope.context = $scope.context || {};
    $scope.listClass = $scope.listClass || '';
    */

    // TODO Get rid of the $timeouts - not sure why $q.when alone breaks when we return results from cache

    $scope.doRefresh = function() {
      $scope.loading.data = true;
      $scope.loading.pageCount = true;

//        $timeout(function() {
//            $scope.items = [];
//            $scope.totalItems = 0;
//        });

        var listFilter = $scope.listFilter;

        var listService = $scope.listService;
        if(angular.isFunction(listService)) {
            listService = listService();
        }

        if(listService == null) {
            return;
        }

        // TODO if the list service is a function, expect the function to return the actual list service
        // We support the list service to be a promise
        $q.when(listService).then(function(listService) {

            $q.when(listService.fetchCount(listFilter.concept)).then(function(countInfo) {
                $timeout(function() {
                    $scope.totalItems = countInfo.count;
                    $scope.loading.pageCount = false;
                });
            });

            $q.when(listService.fetchItems(listFilter.concept, listFilter.limit, listFilter.offset)).then(function(items) {
                $timeout(function() {
                    $scope.items = items.map(function(item) {
                        return item.val;
                    });
                    $scope.loading.data = false;
                });
            });

        });
    };

    $scope.numPages = function() {
        var limit = $scope.listFilter.limit;

        var result = (limit == null ? 1 : Math.ceil($scope.totalItems / limit));

        result = Math.max(result, 1);
        //console.log('Num pages: ' + result);
        return result;
    };

    $scope.$watch('listFilter.offset', function() {
        $scope.currentPage = Math.floor($scope.listFilter.offset / $scope.listFilter.limit) + 1;
    });

    $scope.$watch('currentPage', function() {
        $scope.listFilter.offset = ($scope.currentPage - 1) * $scope.listFilter.limit;
    });

    $scope.$watch(function() {
        return $scope.rawListService;
    }, function(rawListService) {
       jassa.util.PromiseUtils.replaceService($scope, 'listService', rawListService);
    });

    $scope.$watch('[listFilter, refresh]', $scope.doRefresh, true);
    $scope.$watch('listService', $scope.doRefresh);
}])

.directive('jassaList', [function() {
    return {
        restrict: 'EA',
        templateUrl: 'template/jassa-list/jassa-list.html',
        transclude: true,
        //replace: true,
        //scope: true,
        scope: {
            rawListService: '=listService',
            listFilter: '=?', // Any object with the fields {concept, offset, limit}. No need for jassa.service.ListFilter.

            listClass: '=?', // CSS class to apply to the inner list
            paginationOptions: '=?', // Pagination Options

            totalItems: '=?',
            items: '=?',
            loading: '=?',

            //currentPage: '=',
            refresh: '=?', // Extra attribute that is deep watched on changes for triggering refreshs
            context: '=?' // Extra data that can be passed in // TODO I would prefer access to the parent scope
        },
        controller: 'JassaListCtrl',
        link: function(scope, element, attrs, ctrl, transcludeFn) {
            //console.log('My scope: ', scope);
            //var childScope = scope.$new();
//            transcludeFn(childScope, function(clone, scope) {
//                var e = element.find('ng-transclude');
//                var p = e.parent();
//                e.remove();
//                p.append(clone);
//            });


            //transcludeFn(scope, function(clone, scope) {
//                element.append(clone);
//            });


            transcludeFn(scope, function(clone, scope) {
                var e = element.find('ng-transclude');
                var p = e.parent();
                e.remove();
                p.append(clone);
            });
        }
    };
}])

;

angular.module('ui.jassa.jassa-list-browser', [])

.controller('JassaListBrowserCtrl', ['$scope', function($scope) {
    $scope.context = $scope.context || {};

}])

.directive('jassaListBrowser', function() {
    return {
        restrict: 'EA',
        replace: true,
        scope: {
            listService: '=',
            filter: '=',
            limit: '=',
            offset: '=',
            totalItems: '=',
            items: '=',
            maxSize: '=',
            langs: '=', // Extra attribute that is deep watched on changes for triggering refreshs
            availableLangs: '=',
            doFilter: '=',
            searchModes: '=',
            activeSearchMode: '=',
            itemTemplate: '=',
            context: '=?' // Extra data that can be passed in // TODO I would prefer access to the parent scope
        },
        templateUrl: 'template/jassa-list-browser/jassa-list-browser.html',
        controller: 'JassaListBrowserCtrl'
    };
})

;

angular.module('ui.jassa.jassa-media-list', ['ui.jassa.replace'])

.controller('JassaMediaListCtrl', ['$scope', '$q', '$timeout', function($scope, $q, $timeout) {
    $scope.currentPage = 1;

    $scope.limit = $scope.limit || 10;
    $scope.offset = $scope.offset || 0;
    $scope.items = $scope.items || [];
    $scope.maxSize = $scope.maxSize || 6;




    // TODO Get rid of the $timeouts - not sure why $q.when alone breaks when we return results from cache

    $scope.doRefresh = function() {
        $q.when($scope.listService.fetchCount($scope.filter)).then(function(countInfo) {
            $timeout(function() {
                $scope.totalItems = countInfo.count;
            });
        });

        $q.when($scope.listService.fetchItems($scope.filter, $scope.limit, $scope.offset)).then(function(items) {
            $timeout(function() {
                $scope.items = items.map(function(item) {
                    return item.val;
                });
            });
        });
    };


    $scope.$watch('offset', function() {
        $scope.currentPage = Math.floor($scope.offset / $scope.limit) + 1;
    });

    $scope.$watch('currentPage', function() {
        $scope.offset = ($scope.currentPage - 1) * $scope.limit;
    });


    $scope.$watch('[filter, limit, offset, refresh]', $scope.doRefresh, true);
    $scope.$watch('listService', $scope.doRefresh);
}])

.directive('jassaMediaList', [function() {
    return {
        restrict: 'EA',
        templateUrl: 'template/jassa-media-list/jassa-media-list.html',
        //transclude: true,
        replace: true,
        scope: {
            listService: '=',
            filter: '=?',
            limit: '=?',
            offset: '=?',
            totalItems: '=?',
            //currentPage: '=',
            itemTemplate: '=',
            items: '=?',
            maxSize: '=?',
            refresh: '=?', // Extra attribute that is deep watched on changes for triggering refreshs
            context: '=?' // Extra data that can be passed in // TODO I would prefer access to the parent scope
        },
        controller: 'JassaMediaListCtrl',
        link: function(scope, element, attrs, ctrl, transcludeFn) {
//            transcludeFn(scope, function(clone, scope) {
//                var e = element.find('ng-transclude');
//                var p = e.parent();
//                e.remove();
//                p.append(clone);
//            });
        }
    };
}])

;

angular.module('ui.jassa.lang-select', ['ui.sortable', 'ui.keypress', 'ngSanitize'])

.controller('LangSelectCtrl', ['$scope', function($scope) {
    $scope.newLang = '';
    $scope.showLangInput = false;

    var removeIntent = false;

    $scope.sortConfig = {
        placeholder: 'lang-sortable-placeholder',
        receive: function(e, ui) { removeIntent = false; },
        over: function(e, ui) { removeIntent = false; },
        out: function(e, ui) { removeIntent = true; },
        beforeStop: function(e, ui) {
            if (removeIntent === true) {
                var lang = ui.item.context.textContent;
                if(lang) {
                    lang = lang.trim();
                    var i = $scope.langs.indexOf(lang);
                    $scope.langs.splice(i, 1);
                    ui.item.remove();
                }
            }
        },
        stop: function() {
            if(!$scope.$$phase) {
                $scope.$apply();
            }
        }
    };

    $scope.getLangSuggestions = function() {
        var obj = $scope.availableLangs;

        var result;
        if(!obj) {
            result = [];
        }
        else if(Array.isArray(obj)) {
            result = obj;
        }
        else if(obj instanceof Function) {
            result = obj();
        }
        else {
            result = [];
        }

        return result;
    };

    $scope.confirmAddLang = function(lang) {

        var i = $scope.langs.indexOf(lang);
        if(i < 0) {
            $scope.langs.push(lang);
        }
        $scope.showLangInput = false;
        $scope.newLang = '';
    };
}])

.directive('langSelect', function() {
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'template/lang-select/lang-select.html',
        scope: {
            langs: '=',
            availableLangs: '='
        },
        controller: 'LangSelectCtrl',
    };
})

;


angular.module('ui.jassa.list-search', [])

.controller('ListSearchCtrl', ['$scope', function($scope) {
    // Don't ask me why this assignment does not trigger a digest
    // if performed inline in the directive...
    $scope.setActiveSearchMode = function(searchMode) {
        $scope.activeSearchMode = searchMode;
    };
}])

.directive('listSearch', function() {
    return {
        restrict: 'EA',
        scope: {
            searchModes: '=',
            activeSearchMode: '=',
            ngModel: '=',
            onSubmit: '&submit'
        },
        controller: 'ListSearchCtrl',
        templateUrl: 'template/list-search/list-search.html'
    };
})

;


angular.module('ui.jassa.paging-model', [])

/**
 * A convenience directive which expands itself to several other html attributes
 *
 * {{ls.state.paging.totalItems}}
 * {{ls.state.filter.limit}}
 * {{ls.ctrl.paging.currentPage}}
 *
 *
 * &lt;pagination paging-style="list.pagingStyle" &gt;
 */
.directive('pagingModel', ['$compile', function($compile) {

    return {
        priority: 1050,
        restrict: 'A',
        terminal: true,
        scope: false,
        compile: function(ele, attrs) {
            return {
                pre: function(scope, elem, attrs, ctrls) {
                    // If the attribute is not present, add it
                    var setDefaultAttr = function(key, val) {
                        var expr = elem.attr(key);
                        if(expr == null) {
                            elem.attr(key, val);
                        }
                    };


                    var base = attrs.pagingModel;
                    if(base == null) {
                        throw new Error('Object needed as argument for paging-model');
                    }

                    elem.removeAttr('paging-model');

                    setDefaultAttr('total-items', base + '.state.paging.totalItems');
                    setDefaultAttr('items-per-page', base + '.state.filter.limit');
                    setDefaultAttr('ng-model', base + '.ctrl.paging.currentPage');

                    // Fallback for legacy versions of ui bootstrap
                    setDefaultAttr('page', base + '.ctrl.paging.currentPage');

                    $compile(elem)(scope);
                }
            };
        }
    };
}])

;

//var jassa = jassa || {};
//jassa.angular = jassa.angular || {};
//jassa.angular.
var ListServiceWatcher = Jassa.ext.Class.create({
    initialize: function($scope, $q) {
        this.$scope = $scope;
        this.$q = $q;
    },


    // Returns an object that is actively watched by angular
    watch: function(rawListServiceExpr, defaults, result) {

        var $scope = this.$scope;
        var $q = this.$q;


        var tryCatch = function(fn, def) {
            var r;
            try {
                r = fn();
            } catch(e) {
                r = def || null;
            }

            return r;
        };

        // Set up the result object and apply defaults
        result = result || {};

//        var defaultsDeep = function(target, source) {
//            _.forEach(source, function(v, k) {
//            });
//        }

        // TODO We should use a recursive defaults method

        var defs = ListServiceWatcher.getDefaults();
        _.defaults(result, defs);

        _.defaults(result.state, defs.state);
        //_.defaults(result.state.entries, defs.state.entries);
        _.defaults(result.state.listService, defs.state.listService);
        _.defaults(result.state.filter, defs.state.filter);
        _.defaults(result.state.paging, defs.state.paging);

        _.defaults(result.loading, defs.loading);

        _.defaults(result.ctrl, defs.ctrl);
        _.defaults(result.ctrl.listService, defs.ctrl.listService);
        _.defaults(result.ctrl.filter, defs.ctrl.filter);
        _.defaults(result.ctrl.paging, defs.ctrl.paging);


        _.defaults(result.paginationOptions, defs.paginationOptions);


        // Util method
        var calcNumPages = function() {
            var limit = tryCatch(function() { return result.state.filter.limit; });
            var totalItems = tryCatch(function() { return result.state.paging.totalItems; }, 0);

            var r = (limit == null ? 1 : Math.ceil(totalItems / limit));

            r = Math.max(r, 1);
            return r;
        };


        //result.ctrl.listService = rawListServiceExpr;

        result.doRefresh = function() {
            var p1 = result.doRefreshCount();
            var p2 = result.doRefreshData();

            var r = jassa.util.PromiseUtils.all([p1, p2]);
            return r;
        };

        result.doRefreshData = function() {
            result.loading.data = true;

            var filter = result.ctrl.filter;
            var listService = result.state.listService;

            var r;
            if(listService != null) {
                r = Promise.resolve(listService).then(function(listService) {
                    $q.when(listService.fetchItems(filter.concept, filter.limit, filter.offset)).then(function(entries) {

                        result.state.entries = entries;

                        result.state.items = entries.map(function(entry) {
                            return entry.val;
                        });

                        result.loading.data = false;

                        result.state.filter.limit = result.ctrl.filter.limit;
                        result.state.filter.offset = result.ctrl.filter.offset;
                        //result.state.listService = result.ctrl.listService;
                    });
                }, function() {
                    result.loading.data = false;
                });
            } else {
                r = Promise.resolve({});
            }

            return r;
        };

        result.doRefreshCount = function() {

            var filter = result.ctrl.filter;
            var listService = result.state.listService;

            var r;
            if(listService != null) {
                result.loading.pageCount = true;

                r = Promise.resolve(listService).then(function(listService) {
                    $q.when(listService.fetchCount(filter.concept)).then(function(countInfo) {
                          //$scope.totalItems = countInfo.count;
                        result.state.paging.totalItems = countInfo.count;

                        result.state.paging.numPages = calcNumPages();


                        result.loading.pageCount = false;
                    }, function() {
                        result.loading.pageCount = false;
                    });
                });
            } else {
                r = Promise.resolve({});
            }

            return r;
        };


        result.unwatch = function() {
            result.watchers.forEach(function(watcher) {
               watcher();
            });

            jassa.util.ArrayUtils.clear(result.watchers);
        };

        result.cancelAll = function() {
            var ls = result.state.listService;
            if(ls) {
                ls.cancelAll();
            }
        };


        // Keep track of all watchers, so we can unregister them all if desired
        result.watchers = result.watchers || [];
        var addWatch = function() {
            var r = $scope.$watch.apply($scope, arguments);
            result.watchers.push(r);
            return r;
        };

        addWatch(rawListServiceExpr, function(lse) {
            result.ctrl.listService = lse;
        });

        addWatch(function() {
            return result.ctrl.listService;
        }, function(listService) {
            if(result.cancelAll) {
                result.cancelAll();
            }

            //result.state.listService = jassa.util.PromiseUtils.lastRequestify(rawListService);
            jassa.util.PromiseUtils.replaceService(result.state, 'listService', listService);

            result.doRefresh();
        });

        addWatch(function() {
            return result.ctrl.filter;
        }, function() {
            result.doRefresh();
        }, true);

        addWatch(function() {
            return result.ctrl.filter.offset;
        }, function(offset) {
            var limit = result.ctrl.filter.limit;
            result.state.paging.currentPage = Math.max(Math.floor(offset / limit) + 1, 1);

            result.doRefreshData();
        });

        addWatch(function() {
            return result.ctrl.paging.currentPage;
        }, function(currentPage) {
            var limit = result.ctrl.filter.limit;
            result.ctrl.filter.offset = (currentPage - 1) * limit;

            result.doRefreshData();
        });

//        addWatch(function() {
//            return $scope.rawListService;
//        }, function(rawListService) {
//           jassa.util.PromiseUtils.replaceService($scope, 'listService', rawListService);
//        });

//        addWatch('[filter, refresh]', $scope.doRefresh, true);
//        addWatch('listService', $scope.doRefresh);

        return result;
    }
});


ListServiceWatcher.getDefaults = function() {
    var result = {
        state: {
            items: [],
            entries: [],
            filter: { // The filter that applies to the current list of items
                concept: null,
                limit: 10,
                offset: 0
            },
            listService: null,
            paging: {
                currentPage: 1,
                numPages: 1,
                totalItems: 0
            }
        },
        loading: {
            data: false,
            pageCount: false
        },
        ctrl: { // Control attributes; changing these will modify the state
            listService: null,
            filter: { // The filter to execute
                concept: null,
                limit: 10,
                offset: 0
            },
            paging: {
                currentPage: 1
                //numPages: 1,
                //totalItems: 0
            }
        },
        watchers: []
    };

    return result;
};

angular.module('ui.jassa.paging-style', [])

/**
 * A convenience directive which expands itself to several other html attributes
 *
 * total-items
 * items-per-page
 * max-size
 * num-pages
 * rotate
 * direction-links
 * previous-text
 * next-text
 * boundary-links
 * first-text
 * last-text
 *
 * &lt;pagination paging-style="list.pagingStyle" &gt;
 */
.directive('pagingStyle', ['$compile', '$parse', function($compile, $parse) {

    return {
        priority: 1050,
        restrict: 'A',
        terminal: true,
        scope: false,
        compile: function(elem, attrs) {
            return {
                pre: function(scope, elem, attrs, ctrls) {
                    var createDefaults = function() {
                        return {
                            maxSize: 6,
                            rotate: true,
                            boundaryLinks: true,
                            directionLinks: true,
                            firstText: '<<',
                            previousText: '<',
                            nextText: '>',
                            lastText: '>>'
                            /*
                            firstText: '&lt;&lt;',
                            previousText: '&lt;',
                            nextText: '&gt;',
                            lastText: '&gt;&gt;'
                            */
                        };
                    };

                    // If the attribute is not present, add it
                    var setDefaultAttr = function(key, val, interpolate) {
                        var expr = elem.attr(key);
                        if(expr == null) {

                            var v = interpolate ? '{{' + val + '}}' : val;
                            elem.attr(key, v);
                        }
                    };


                    var base = attrs.pagingStyle;
                    if(base == null) {
                        base = 'pagingStyle';
                        scope.pagingStyle = {};
                    }

                    elem.removeAttr('paging-style');

                    setDefaultAttr('max-size', base + '.maxSize', true);
                    setDefaultAttr('rotate', base + '.rotate', true);
                    setDefaultAttr('boundary-links', base + '.boundaryLinks', true);
                    setDefaultAttr('first-text', base + '.firstText', true);
                    setDefaultAttr('previous-text', base + '.previousText', true);
                    setDefaultAttr('next-text', base + '.nextText', true);
                    setDefaultAttr('last-text', base + '.lastText', true);
                    setDefaultAttr('direction-links', base + '.directionLinks', true);

                    var defs = createDefaults();

                    var exprStr = attrs.pagingStyle;
                    var modelGetter = $parse(exprStr);

                    var initModel = function(obj) {
                        obj = obj || modelGetter(scope);
                        if(obj != null) {
                            _.defaults(obj, defs);
                        }
                    };

                    scope.$watch(function() {
                        var r = modelGetter(scope);
                        return r;
                    }, function(obj) {
                        initModel(obj);
                    }, true);

                    initModel();

                    $compile(elem)(scope);
                }
            };
        }
    };
}])

;

angular.module('ui.jassa.pointer-events-scroll-fix', [])

/**
 * Scrollbars on overflow divs with pointer-events: none are not clickable on chrome/chromium.
 * This directive sets pointer-events to auto when scrollbars are needed and thus assumed to be visible.
 *
 */
.directive('pointerEventsScrollFix', function() {
    return {
        restrict: 'A',
        //scope:
        compile: function() {
            return {
                post: function(scope, elem, attrs) {

                    // TODO Registering (jQuery) plugins in a directive is actually an anti-pattern - either get rid of this or move the plugin to a common location
                    if(!jQuery.fn.hasScrollBar) {
                        jQuery.fn.hasScrollBar = function() {
                            var el = this.get(0);
                            if(!el) {
                                console.log('Should not happen');
                                return false;
                            }

                            var result = el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
                            //console.log('Checked scrollbar state: ', result);
                            return result;
                        };
                    }

                    var backup = null;

                    scope.$watch(
                        function () { return jQuery(elem).hasScrollBar(); },
                        function (hasScrollBar) {
                            //console.log('Scrollbar state: ', hasScrollBar, backup);
                            if(hasScrollBar) {
                                if(!backup) {
                                    backup = elem.css('pointer-events');
                                    elem.css('pointer-events', 'auto');
                                }
                            } else if(backup) {
                                elem.css('pointer-events', backup);
                                backup = null;
                            }
                        }
                    );
                }
            };
        }
    };
})

;


angular.module('ui.jassa.replace', [])

.directive('replace', function () {
    return {
        //require: 'ngInclude',
        restrict: 'A', /* optional */
        link: function (scope, el, attrs) {
            el.replaceWith(el.children());
        }
    };
})

;

angular.module('ui.jassa.resizable', [])

/**
 *
 * <div resizable="resizableConfig" bounds="myBoundObject" on-resize-init="onResizeInit(bounds)" on-resize="onResize(evt, ui, bounds)" style="width: 50px; height: 50px;">
 *
 * On init, the the directive will invoke on-resize-init with the original css properties (not the computed values).
 * This allows resetting the size
 * Also, on init, the given bounds will be overridden, however, afterwards the directive will listen for changes
 */
.directive('resizable', function () {
    //var resizableConfig = {...};
    return {
        restrict: 'A',
        scope: {
            resizable: '=',
            onResize: '&onResize',
            onResizeInit: '&onResizeInit',
            bounds: '='
        },
        compile: function() {
            return {
                post: function(scope, elem, attrs) {
                    if(!scope.bounds) {
                        scope.bounds = {};
                    }

                    var isInitialized = false;

                    var onConfigChange = function(newConfig) {
                        //console.log('Setting config', newConfig);
                        if(isInitialized) {
                            jQuery(elem).resizable('destroy');
                        }

                        jQuery(elem).resizable(newConfig);
                        
                        isInitialized = true;
                    };
                    

                    var propNames = ['top', 'bottom', 'width', 'height'];
                    
                    var getCssPropMap = function(propNames) {
                        var data = elem.prop('style');
                        var result = _(data).pick(propNames);
                        
                        return result;
                    };
                    
                    var setCssPropMap = function(propMap) {
                        _(propMap).each(function(v, k) {
                            //console.log('css prop', k, v);
                            elem.css(k, v);
                        });
                    };

                    var bounds = getCssPropMap(propNames);
                    angular.copy(bounds, scope.bounds);
                    
                    if(scope.onResizeInit) {
                        scope.onResizeInit({
                            bounds: bounds
                        });
                    }
                    
                    var onBoundsChange = function(newBounds, oldBounds) {
                        //console.log('setting bounds', newBounds, oldBounds);
                        setCssPropMap(newBounds);
                    };
                    
                    scope.$watch('bounds', onBoundsChange, true);

                    jQuery(elem).on('resizestop', function (evt, ui) {
                        
                        var bounds = getCssPropMap(propNames);
                        angular.copy(bounds, scope.bounds);
                        //console.log('sigh', bounds);
                        
                        if (scope.onResize) {
                            scope.onResize(evt, ui, bounds);
                        }
                        
                        if(!scope.$$phase) {
                            scope.$apply();
                        }
                    });

                    scope.$watch('resizable', onConfigChange);
                    //onConfigChange(scope.resizable);
                }
            };
        }
    };
})

;



// 'luegg.directives'
angular.module('ui.jassa.scroll-glue-right', [])

// Adapted version from https://github.com/Luegg/angularjs-scroll-glue/blob/master/src/scrollglue.js
.directive('scrollGlueRight', ['$parse', '$timeout', function($parse, $timeout) {
    function unboundState(initValue){
        var activated = initValue;
        return {
            getValue: function(){
                return activated;
            },
            setValue: function(value){
                activated = value;
            }
        };
    }

    function oneWayBindingState(getter, scope){
        return {
            getValue: function(){
                return getter(scope);
            },
            setValue: function(){}
        };
    }

    function twoWayBindingState(getter, setter, scope){
        return {
            getValue: function(){
                return getter(scope);
            },
            setValue: function(value){
                if(value !== getter(scope)){
                    scope.$apply(function(){
                        setter(scope, value);
                    });
                }
            }
        };
    }

    function createActivationState(attr, scope){
        if(attr !== ''){
            var getter = $parse(attr);
            if(getter.assign !== undefined){
                return twoWayBindingState(getter, getter.assign, scope);
            } else {
                return oneWayBindingState(getter, scope);
            }
        } else {
            return unboundState(true);
        }
    }

    return {
        priority: 1,
        restrict: 'A',
        link: function(scope, $el, attrs){
            var el = $el[0],
                activationState = createActivationState(attrs.scrollGlueRight, scope);

            function scrollToBottom(){
                el.scrollTop = el.scrollHeight;
            }

            function scrollToRight(){
                el.scrollLeft = el.scrollWidth;
            }

            function onScopeChanges(scope){
                if(activationState.getValue() && !shouldActivateAutoScroll()){
                    //scrollToBottom();
                    //$timeout(scrollToRight, 50);
                    scrollToRight();
                }
            }

            function shouldActivateAutoScroll(){
                // + 1 catches off by one errors in chrome
                //return el.scrollTop + el.clientHeight + 1 >= el.scrollHeight;
                var result = el.scrollLeft + el.clientWidth + 1 >= el.scrollWidth;
                return result;
            }

            function onScroll(){
                activationState.setValue(shouldActivateAutoScroll());
            }

            scope.$watch(function() {
                return el.clientWidth;
            }, function(w) {
                //console.log('client width: ', w, el.scrollWidth);
                onScopeChanges();
            });

            scope.$watch(onScopeChanges);
            $el.bind('scroll', onScroll);
        }
    };
}])

;

angular.module('ui.jassa.sparql-grid', [])

.controller('SparqlGridCtrl', ['$scope', '$rootScope', '$q', function($scope, $rootScope, $q) {

    var rdf = jassa.rdf;
    var sparql = jassa.sparql;
    var service = jassa.service;
    var util = jassa.util;
    var sponate = jassa.sponate;
    var facete = jassas.facete;
    
    var syncTableMod = function(sortInfo, tableMod) {
        
        var newSortConditions = [];
        for(var i = 0; i < sortInfo.fields.length; ++i) {
            var columnId = sortInfo.fields[i];
            var dir = sortInfo.directions[i];
            
            var d = 0;
            if(dir === 'asc') {
                d = 1;
            }
            else if(dir === 'desc') {
                d = -1;
            }
            
            if(d !== 0) {
                var sortCondition = new facete.SortCondition(columnId, d);
                newSortConditions.push(sortCondition);
            }
        }

        var oldSortConditions = tableMod.getSortConditions();
        
        var isTheSame = _(newSortConditions).isEqual(oldSortConditions);
        if(!isTheSame) {
            util.ArrayUtils.replace(oldSortConditions, newSortConditions);
        }

    };

    
    var createTableService = function() {
        var config = $scope.config;
        
        var sparqlService = $scope.sparqlService;
        var queryFactory = config ? config.queryFactory : null;
        
        var query = queryFactory ? queryFactory.createQuery() : null;
        
        var result = new service.SparqlTableService(sparqlService, query);
        
        return result;
    };


    
    $scope.$watch('gridOptions.sortInfo', function(sortInfo) {
        var config = $scope.config;

        var tableMod = config ? config.tableMod : null;

        if(tableMod != null) {
            syncTableMod(sortInfo, tableMod);
        }
        
        $scope.refreshData();
    }, true);


    $scope.$watch('[pagingOptions, filterOptions]', function (newVal, oldVal) {
        $scope.refreshData();
    }, true);
    
    var update = function() {
        $scope.refresh();
    };
    
    
    $scope.ObjectUtils = util.ObjectUtils;
    
    $scope.$watch('[ObjectUtils.hashCode(config), disableRequests]', function (newVal, oldVal) {
        update();
    }, true);
    
    $scope.$watch('sparqlService', function() {
        update();
    });
    
    
    $scope.totalServerItems = 0;
        
    $scope.pagingOptions = {
        pageSizes: [10, 50, 100],
        pageSize: 10,
        currentPage: 1
    };

    $scope.refresh = function() {
        var tableService = createTableService();

        if($scope.disableRequests) {
            util.ArrayUtils.clear($scope.myData);
            return;
        }
        

        $scope.refreshSchema(tableService);
        $scope.refreshPageCount(tableService);
        $scope.refreshData(tableService);
    };

    $scope.refreshSchema = function(tableService) {
        tableService = tableService || createTableService();

        var oldSchema = $scope.colDefs;
        var newSchema = tableService.getSchema();
        
        var isTheSame = _(newSchema).isEqual(oldSchema);
        if(!isTheSame) {
            $scope.colDefs = newSchema;
        }
    };

    $scope.refreshPageCount = function(tableService) {
        tableService = tableService || createTableService();
        
        var promise = tableService.fetchCount();

        jassa.sponate.angular.bridgePromise(promise, $q.defer(), $scope, function(countInfo) {
            // Note: There is also countInfo.hasMoreItems and countInfo.limit (limit where the count was cut off)
            $scope.totalServerItems = countInfo.count;
        });
    };
    
    $scope.refreshData = function(tableService) {
        tableService = tableService || createTableService();

        var page = $scope.pagingOptions.currentPage;
        var pageSize = $scope.pagingOptions.pageSize;
        
        var offset = (page - 1) * pageSize;

        
        var promise = tableService.fetchData(pageSize, offset);

        jassa.sponate.angular.bridgePromise(promise, $q.defer(), $scope, function(data) {
            var isTheSame = _(data).isEqual($scope.myData);
            if(!isTheSame) {
                $scope.myData = data;
            }
            //util.ArrayUtils.replace($scope.myData, data);
            
            // Using equals gives digest iterations exceeded errors; could be https://github.com/angular-ui/ng-grid/issues/873
            //$scope.myData = data;
        });
    };

        
    var plugins = [];
    
    if(ngGridFlexibleHeightPlugin) {
        // js-hint will complain on lower case ctor call
        var PluginCtor = ngGridFlexibleHeightPlugin;
        
        plugins.push(new PluginCtor(30));
    }
    
    $scope.myData = [];
    
    $scope.gridOptions = {
        data: 'myData',
        enablePaging: true,
        useExternalSorting: true,
        showFooter: true,
        totalServerItems: 'totalServerItems',
        enableHighlighting: true,
        sortInfo: {
            fields: [],
            directions: [],
            columns: []
        },
        pagingOptions: $scope.pagingOptions,
        filterOptions: $scope.filterOptions,
        plugins: plugins,
        columnDefs: 'colDefs'
    };

    

    //$scope.refresh();
}])


/**
 * 
 * 
 * config: {
 *     queryFactory: qf,
 *     tableMod: tm
 * }
 * 
 */
.directive('sparqlGrid', ['$parse', function($parse) {
    return {
        restrict: 'EA', // says that this directive is only for html elements
        replace: true,
        //template: '<div></div>',
        templateUrl: 'template/sparql-grid/sparql-grid.html',
        controller: 'SparqlGridCtrl',
        scope: {
            sparqlService: '=',
            config: '=',
            disableRequests: '=',
            onSelect: '&select',
            onUnselect: '&unselect'
        },
        link: function (scope, element, attrs) {
            
        }
    };
}])

;
    
/*    
var createQueryCountQuery = function(query, outputVar) {
    //TODO Deterimine whether a sub query is needed
    var result = new sparql.Query();
    var e = new sparql.ElementSubQuery(query);
    result.getElements().push(e);
    result.getProjectVars().add(outputVar, new sparql.E_Count());
    
    return result;
};
*/

angular.module('ui.jassa.template-list', [])

/**
 *
 */
.controller('TemplateListCtrl', ['$scope', function($scope) {
}])

/**
 *
 */
.directive('templateList', ['$compile', function($compile) {
    return {
        restrict: 'EA',
        replace: true,
        templateUrl: 'template/template-list/template-list.html',
        transclude: true,
        //require: 'templateList',
        scope: {
            templates: '=',
            data: '=',
            context: '='
        },
        controller: 'TemplateListCtrl',
        compile: function() {
            return {
                pre: function(scope, elm, attrs) {
                    angular.forEach(scope.templates, function(template) {
                        var li = $compile('<li style="display: inline;"></li>')(scope);
                        
                        var element = $compile(template)(scope);
                        li.append(element);
                        
                        elm.append(li);
                    });
                }
            };
        }
    };
}])

;
