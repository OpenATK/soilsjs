module.exports = {
  soils: {
    'bookmarks': {
      '_type': "application/vnd.oada.bookmarks.1+json",
      '_rev': 0,
      'soils': {
        //'_type': 'application/vnd.oada.soils.1+json',
        '_type': 'application/json',
        '_rev': 0,
        'fields': {
          '_type': 'application/json',
          '_rev': 0,
          //IDs corresponding to fields
          '*': {
            '_type': 'application/vnd.soils.fields.1+json',
            '_rev': 0,
          }
        },
        'tiled-maps': {
          //'_type': 'application/vnd.oada.soils.1+json',
          '_type': 'application/json',
          '_rev': 0,
          // This is the "parent"/"home" where the raw data lands
          'ssurgo-map-units': {
            '_type': 'application/json',
            '_rev': 0,
            'geohash-5-index': {
              '_type': 'application/json',
              '_rev': 0,
              '*': {
                '_type': 'application/json',
                '_rev': 0,
                'geohash-index': {
                  '_type': 'application/json',
                  '_rev': 0,
                  '*': {
                    '_type': 'application/json',
                    '_rev': 0,
                  }
                }
              }
            },
            'geojson-vt-index': {
              '_type': 'application/json',
              '_rev': 0,
              'z': {
                '*': {
                  'x': {
                    '*': {
                      'y': {
                        '*': {
                          '_type': 'application/json',
                          '_rev': 0,
                        }
                      }
                    }
                  }
                }
              }
            },
          },
          's2-map-unit-contain': {
            '_type': 'application/json',
            '_rev': 0,
            'geohash-length-index': {
              '*': {
                '_type': 'application/json',
                '_rev': 0,
                'geohash-index': {
                  '*': {
                    '_type': 'application/json',
                    '_rev': 0,
                  }
                }
              }
            },
            // This thing 
            'recursive-geohash-minimal': {
              '*': {
                '_type': 'appication/json',
                '_rev': 0,
                'geo-graph-index': {
                  '*': {
                    '_type': 'appication/json',
                    '_rev': 0,
                    'geo-graph-index': {
                      '*': {
                        '_type': 'appication/json',
                        '_rev': 0,
                        'geo-graph-index': {
                          '*': {
                            '_type': 'appication/json',
                            '_rev': 0,
                            'geo-graph-index': {
                              '*': {
                                '_type': 'appication/json',
                                '_rev': 0,
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            'recursive-geohash-rasterize': {
              'geohash-2': {
                '*': {
                  '_type': 'appication/json',
                  '_rev': 0,
                  'geohash-4': {
                    '*': {
                      '_type': 'appication/json',
                      '_rev': 0,
                      'geohash-6': {
                        '*': {
                          '_type': 'appication/json',
                          '_rev': 0,
                          'geohash-8': {
                            '*': {
                              '_type': 'appication/json',
                              '_rev': 0,
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
          },
          'tiles': {
            //'_type': 'application/vnd.oada.soils.1+json',
            '_type': 'application/json',
            '_rev': 0,
            'quad': {
              //'_type': 'application/vnd.oada.soils.1+json',
              '_type': 'application/json',
              '_rev': 0,
              'x': {
                '*': {
                  'y': {
                    '*': {
                      'z': {

                      },
                    },
                  },
                },
              },
            },
            's2': {
              //'_type': 'application/vnd.oada.soils.1+json',
              '_type': 'application/json',
              '_rev': 0,
            },
            'geohash': {
              //'_type': 'application/vnd.oada.soils.1+json',
              '_type': 'application/json',
              '_rev': 0,
            },
          },
        },
        'tabular': {
  //        '_type': 'application/vnd.oada.soils.1+json',
          '_type': 'application/json',
          '_rev': 0,
          'mapunits': {
            '_type': 'application/json',
            '_rev': 0,
            '*': {
              //'_type': 'application/vnd.oada.soils.1+json',
              '_type': 'application/json',
              '_rev': 0,
            }
          },
          'components': {
            '_type': 'application/json',
            '_rev': 0,
            '*': {
              //'_type': 'application/vnd.oada.soils.1+json',
              '_type': 'application/json',
              '_rev': 0,
            }
          },
          'comonths': {
            '_type': 'application/json',
            '_rev': 0,
            '*': {
              //'_type': 'application/vnd.oada.soils.1+json',
              '_type': 'application/json',
              '_rev': 0,
            }
          },
          'horizons': {
            '_type': 'application/json',
            '_rev': 0,
            '*': {
              //'_type': 'application/vnd.oada.soils.1+json',
              '_type': 'application/json',
              '_rev': 0,
            }
          },
          'mapUnitPolygons': {
            '_type': 'application/json',
            '_rev': 0,
            '*': {
              //'_type': 'application/vnd.oada.soils.1+json',
              '_type': 'application/json',
              '_rev': 0,
            }
          },
          'official-series-descriptions': {
            '_type': 'application/json',
            '_rev': 0,
            '*': {
              '_type': 'application/json',
              '_rev': 0,
            }
          }
        }
      }
    }
  },
  fields: {
    'bookmarks': {
      '_type': "application/vnd.oada.bookmarks.1+json",
      '_rev': 0,
      'fields': {
        '_type': 'application/vnd.oada.fields.1+json',
        'fields': {
          '*': {
            '_type': 'application/vnd.oada.fields.1+json',
            '_rev': 0,
          }
        }
      }
    }
  }
}
