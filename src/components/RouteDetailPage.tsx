import React, { useState, useEffect } from 'react'
import { getRouteHeadsigns, getRouteStopsByHeadsign, getStopDetailsWithDepartures } from '../lib/supabase'

interface RouteDetailPageProps {
  route: {
    route_id?: string
    route?: string
    headsign?: string
    type?: string
    bus_id?: string
  }
  onBack: () => void
}


interface StopData {
  headsign: string
  stop_id: string
  stop_name: string
  stop_lat: number
  stop_lon: number
  seq: number
}

// No fallback data - only use real backend data

const RouteDetailPage: React.FC<RouteDetailPageProps> = ({ route, onBack }) => {
  const routeId = route.route_id || route.route || ''
  const [headsigns, setHeadsigns] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [stops, setStops] = useState<StopData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busDepartures, setBusDepartures] = useState<any[]>([])
  const [departuresLoading, setDeparturesLoading] = useState(false)

  useEffect(() => {
    const loadRouteData = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log('Loading route data for route:', routeId)

        // Get headsigns for the route using RPC with fallback
        const headsignList = await getRouteHeadsigns(routeId)
        
        console.debug('route headsigns', { routeId, headsigns: headsignList })
        setHeadsigns(headsignList)
        
        const firstHeadsign = headsignList[0] || null
        setSelected(firstHeadsign)

        // Get stops for the first headsign using RPC with fallback
        if (firstHeadsign) {
          const stopsData = await getRouteStopsByHeadsign(routeId, firstHeadsign)
          console.debug('route stops', { routeId, headsign: firstHeadsign, rows: stopsData.length })
          setStops(stopsData)
        } else {
          setStops([])
        }

      } catch (e: any) {
        console.error('Error loading route data:', e)
        setError(e.message ?? 'Failed to load route data')
      } finally {
        setLoading(false)
      }
    }

    if (routeId) {
      loadRouteData()
    }
  }, [routeId])

  const handleHeadsignChange = async (headsign: string) => {
    try {
      setSelected(headsign)
      setLoading(true)
      setError(null)

      const stopsData = await getRouteStopsByHeadsign(routeId, headsign)
      console.debug('route stops', { routeId, headsign, rows: stopsData.length })
      setStops(stopsData)

    } catch (e: any) {
      console.error('Error loading stops for headsign:', e)
      setError(e.message ?? 'Failed to load stops')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    window.location.reload()
  }

  // 获取当前车站的公交车发车信息
  const loadBusDepartures = async (stopId: string) => {
    try {
      setDeparturesLoading(true)
      const departures = await getStopDetailsWithDepartures(stopId, 120) // 2小时内
      setBusDepartures(departures)
    } catch (e: any) {
      console.error('Error loading bus departures:', e)
      setBusDepartures([])
    } finally {
      setDeparturesLoading(false)
    }
  }

  // 当车站数据加载完成后，获取第一个车站的发车信息
  useEffect(() => {
    if (stops.length > 0) {
      const firstStop = stops[0]
      if (firstStop?.stop_id) {
        loadBusDepartures(firstStop.stop_id)
      }
    }
  }, [stops])

  if (loading && headsigns.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--light-gray)',
        padding: '20px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px',
          gap: '16px'
        }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--primary-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ margin: 0, color: 'var(--primary-blue)', fontSize: '24px' }}>
              Route {routeId}
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Loading route data...
            </p>
          </div>
        </div>

        {/* Loading skeleton */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Loading route data...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--light-gray)',
        padding: '20px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px',
          gap: '16px'
        }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--primary-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ margin: 0, color: 'var(--primary-blue)', fontSize: '24px' }}>
              Error
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Failed to load route data
            </p>
          </div>
        </div>

        {/* Error message */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{
            color: '#dc2626',
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '16px'
          }}>
            ⚠️ Error Loading Route Data
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            {error}
          </p>
          <button
            onClick={handleRetry}
            style={{
              padding: '12px 24px',
              backgroundColor: 'var(--primary-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        /* Thin scrollbar for webkit browsers */
        .thin-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        
        .thin-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        
        .thin-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        
        .thin-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Tunables */
        .route-map {
          --dot-size: 16px;       /* stop dot diameter */
          --line-thickness: 6px;  /* route line thickness */
          --gap: 48px;            /* horizontal gap between stops */
          --label-gap: 10px;      /* space from dot to label */
          --label-max-width: 120px; /* max width for stop labels */
        }

        /* Make the route area taller to prevent text overlap */
        .route-canvas {
          position: relative;
          min-height: 140px;                   /* reduce height by 20px */
          padding: 0 calc(var(--dot-size) / 2);/* so the line reaches dot centers */
        }

        /* Draw the single connecting line at dot level */
        .route-canvas::before {
          content: "";
          position: absolute;
          top: calc(70px + var(--dot-size) / 2); /* align with new dot centers */
          left: calc(var(--dot-size) / 2);
          right: calc(var(--dot-size) / 2);
          height: var(--line-thickness);
          background: #93c5fd;                 /* lighter blue color */
          transform: translateY(-50%);         /* center the line */
          border-radius: var(--line-thickness);
          z-index: 0;                          /* behind dots */
          opacity: 0.8;                        /* slightly more transparent */
        }

        /* The strip that holds all stops */
        .stop-strip {
          position: relative;
          display: flex;
          gap: var(--gap);
          overflow-x: auto;
          padding: 0;                          /* ↓ no vertical padding */
          height: 100%;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }

        .stop-strip::-webkit-scrollbar {
          height: 4px;
        }
        
        .stop-strip::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 2px;
        }
        
        .stop-strip::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }
        
        .stop-strip::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Each stop: dot positioned absolutely on the line, label below */
        .stop-col {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: var(--label-max-width);
          flex-shrink: 0;
          padding-top: 70px; /* increase padding by additional 20px */
        }

        .stop-dot {
          position: absolute;
          top: 70px;                           /* position at new padding-top level */
          left: 50%;
          transform: translateX(-50%);          /* center horizontally */
          z-index: 1;                          /* above the line */
          width: var(--dot-size);
          height: var(--dot-size);
          border-radius: 9999px;
          background: #2563eb;
          box-shadow: 0 2px 6px rgba(37,99,235,.25);
        }

        .stop-dot.is-transfer { background: #f59e0b; }  /* orange for transfer */
        .stop-dot.is-regular  { background: #2563eb; }  /* blue for regular */

        .stop-label {
          margin-top: 30px;                    /* move text down by 20px */
          max-width: var(--label-max-width);
          text-align: center;
          font-size: 14px;                     /* slightly larger font */
          font-weight: 500;
          color: #374151;
          line-height: 1.4;                    /* more comfortable line height */
          word-wrap: break-word;
          white-space: normal;
          hyphens: auto;
        }

        /* Optional: make route area slightly taller on mobile */
        @media (max-width: 640px) {
          .route-canvas { min-height: 160px; }
        }
      `}</style>
      <div style={{
        minHeight: '100vh',
        background: 'var(--light-gray)',
        padding: '20px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px',
          gap: '16px'
        }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--primary-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ margin: 0, color: 'var(--primary-blue)', fontSize: '24px' }}>
              Route {routeId}
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              {selected ? `To: ${selected}` : 'Select direction'} • {stops.length} stops
            </p>
          </div>
        </div>

        {/* Headsign Tabs */}
        {headsigns.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              color: 'var(--primary-blue)',
              fontSize: '16px'
            }}>
              Direction
            </h3>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {headsigns.map((headsign) => (
                <button
                  key={headsign}
                  onClick={() => handleHeadsignChange(headsign)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: selected === headsign ? 'var(--primary-blue)' : 'var(--light-gray)',
                    color: selected === headsign ? 'white' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: selected === headsign ? 'bold' : 'normal',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {headsign}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Route Summary */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
        <h2 style={{
          margin: '0 0 16px 0',
          color: 'var(--primary-blue)',
          fontSize: '20px'
        }}>
          Route Summary
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <div>
            <strong>Route ID:</strong> {routeId}
          </div>
          <div>
            <strong>Route Name:</strong> {routeId}
          </div>
          <div>
            <strong>Bus ID:</strong> {route.bus_id || 'N/A'}
          </div>
          <div>
            <strong>Direction:</strong> {selected || 'None selected'}
          </div>
          <div>
            <strong>Type:</strong> {route.type || 'bus'}
          </div>
          <div>
            <strong>Total Stops:</strong> {new Set(stops.map(s => s.stop_id)).size}
          </div>
        </div>
      </div>

      {/* Route Map */}
      {stops.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '12px 20px',  // 合理的垂直padding
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{
            margin: '0 0 8px 0',  // 合理的底部间距
            color: 'var(--primary-blue)',
            fontSize: '16px'      // 合适的字体大小
          }}>
            Route Map
          </h3>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',  // 合理的底部间距
            padding: '8px',        // 合理的内边距
            backgroundColor: 'var(--light-gray)',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: 'var(--primary-blue)',
                borderRadius: '50%'
              }}></div>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Regular Station
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: '#f59e0b',
                borderRadius: '50%'
              }}></div>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Transfer Station
              </span>
            </div>
          </div>

          <section className="route-map">
            <div className="route-canvas">
              <div className="stop-strip">
                {stops.map((stop, index) => {
                  const isTransfer = stop.stop_name.toLowerCase().includes('metro') || 
                                    stop.stop_name.toLowerCase().includes('station') ||
                                    stop.stop_name.toLowerCase().includes('bus stop')
                  
                  return (
                    <div key={`${stop.seq || index}-${stop.stop_id}`} className="stop-col">
                      <div className={`stop-dot ${isTransfer ? 'is-transfer' : 'is-regular'}`} />
                      <div className="stop-label">{stop.stop_name}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Real-time Bus Departures */}
      {stops.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            color: 'var(--primary-blue)',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🚌 Real-time Bus Departures
            {stops[0] && (
              <span style={{
                fontSize: '14px',
                fontWeight: 'normal',
                color: '#6b7280'
              }}>
                from {stops[0].stop_name}
              </span>
            )}
          </h3>
          
          {departuresLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <div className="loading-spinner" style={{ marginRight: '8px' }}></div>
              Loading bus departures...
            </div>
          ) : busDepartures.length > 0 ? (
            <div style={{
              overflowX: 'auto',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: '#f9fafb',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderRight: '1px solid #e5e7eb'
                    }}>
                      Wait Time
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderRight: '1px solid #e5e7eb'
                    }}>
                      Route
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderRight: '1px solid #e5e7eb'
                    }}>
                      Direction
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderRight: '1px solid #e5e7eb'
                    }}>
                      Bus ID
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Next Departure
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {busDepartures.slice(0, 10).map((departure, index) => {
                    const waitMinutes = Math.floor(departure.wait_seconds / 60)
                    const waitSeconds = departure.wait_seconds % 60
                    const isNow = waitMinutes === 0 && waitSeconds <= 30
                    const isSoon = waitMinutes <= 5
                    const isLate = waitMinutes > 30
                    
                    return (
                      <tr key={index} style={{
                        backgroundColor: isNow ? '#fef3c7' : (index % 2 === 0 ? '#ffffff' : '#f9fafb'),
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <td style={{
                          padding: '12px 16px',
                          borderRight: '1px solid #e5e7eb',
                          fontWeight: '600',
                          color: isNow ? '#f59e0b' : (isSoon ? '#ef4444' : (isLate ? '#10b981' : '#2563eb'))
                        }}>
                          {isNow ? 'NOW' : `${waitMinutes}m`}
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          borderRight: '1px solid #e5e7eb',
                          fontWeight: '600',
                          color: '#1f2937'
                        }}>
                          {departure.route}
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          borderRight: '1px solid #e5e7eb',
                          color: '#374151'
                        }}>
                          {departure.headsign}
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          borderRight: '1px solid #e5e7eb',
                          color: '#6b7280'
                        }}>
                          {departure.bus_id || 'N/A'}
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          color: '#6b7280'
                        }}>
                          {departure.next_departure_time || 'N/A'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚌</div>
              <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                No buses scheduled
              </div>
              <div style={{ fontSize: '14px' }}>
                No bus departures found for the next 2 hours
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {stops.length === 0 && !loading && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            fontSize: '18px',
            color: 'var(--text-secondary)',
            marginBottom: '8px'
          }}>
            📭
          </div>
          <p style={{
            color: 'var(--text-secondary)',
            margin: 0,
            fontSize: '16px'
          }}>
            No stops found for this direction.
          </p>
        </div>
      )}
      </div>
    </>
  )
}

export default RouteDetailPage
