import React, { useState, useEffect } from 'react'
import { getStopHeader, getStopDetailsWithDepartures } from '../lib/supabase'

interface StopDetailPageProps {
  stopId: string
}

interface StopHeader {
  stop_id: string
  stop_name: string
  stop_lat: number
  stop_lon: number
}

interface DepartureRow {
  stop_id: string
  stop_name: string
  route_id: string
  route_short_name: string
  route_long_name: string
  trip_id: string
  trip_headsign: string
  departure_time: string
  wait_seconds: number
}

const StopDetailPage: React.FC<StopDetailPageProps> = ({ stopId }) => {
  const [rows, setRows] = useState<DepartureRow[]>([])
  const [stopHeader, setStopHeader] = useState<StopHeader | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadStopDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log('Loading stop details for stop_id:', stopId)

        // Get stop header information
        const header = await getStopHeader(stopId)
        if (!active) return
        setStopHeader(header)

        // Get departures for next 2 hours using RPC
        const sortedData = await getStopDetailsWithDepartures(stopId, 120)
        if (!active) return
        setRows(sortedData)

        console.log(`Loaded ${sortedData.length} departures for stop ${stopId}`)

      } catch (e: any) {
        console.error('Error loading stop details:', e)
        if (!active) return
        setError(e.message ?? 'Failed to load stop details')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadStopDetails()

    return () => {
      active = false
    }
  }, [stopId])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    // Trigger reload by updating a dependency
    window.location.reload()
  }

  const handleBack = () => {
    window.history.back()
  }

  // Get unique route names for chips
  const uniqueRoutes = [...new Set(rows.map(row => row.route_short_name))]

  // Format wait time
  const formatWaitTime = (waitSeconds: number) => {
    const minutes = Math.ceil(waitSeconds / 60)
    if (minutes <= 0) return 'Now'
    if (minutes === 1) return '1 min'
    return `${minutes} min`
  }

  // Format departure time
  const formatDepartureTime = (departureTime: string) => {
    try {
      const time = new Date(departureTime)
      return time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    } catch {
      return departureTime
    }
  }

  if (loading) {
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
            onClick={handleBack}
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
              Loading...
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Loading departures...
            </p>
          </div>
        </div>

        {/* Loading skeleton */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '16px' }}>
            Loading departures...
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
            onClick={handleBack}
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
              Failed to load stop details
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
            ⚠️ Error Loading Stop Details
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
          onClick={handleBack}
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
            {stopHeader?.stop_name || 'Unknown Stop'}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Stop ID: {stopId} • {rows.length} departures in next 2 hours
          </p>
        </div>
      </div>

      {/* Route chips */}
      {uniqueRoutes.length > 0 && (
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
            Available Routes
          </h3>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {uniqueRoutes.map((route, index) => (
              <span
                key={index}
                style={{
                  backgroundColor: 'var(--primary-blue)',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {route}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Departures list */}
      {rows.length > 0 ? (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            color: 'var(--primary-blue)',
            fontSize: '18px'
          }}>
            Next Departures
          </h3>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {rows.map((row, index) => (
              <div
                key={`${row.trip_id}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: 'var(--light-gray)',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}
              >
                <div style={{
                  backgroundColor: 'var(--primary-blue)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginRight: '12px',
                  minWidth: '40px',
                  textAlign: 'center'
                }}>
                  {row.route_short_name}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 'bold',
                    color: 'var(--text-primary)',
                    marginBottom: '4px'
                  }}>
                    → {row.trip_headsign}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}>
                    {row.route_long_name}
                  </div>
                </div>
                
                <div style={{
                  textAlign: 'right',
                  minWidth: '120px'
                }}>
                  <div style={{
                    fontWeight: 'bold',
                    color: 'var(--primary-blue)',
                    fontSize: '16px'
                  }}>
                    {formatWaitTime(row.wait_seconds)}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)'
                  }}>
                    at {formatDepartureTime(row.departure_time)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
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
            No scheduled departures in the next 2 hours.
          </p>
        </div>
      )}

      {/* Debug footer */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        fontFamily: 'monospace'
      }}>
        <strong>Debug:</strong> stop_id: {stopId}, rows: {rows.length}, first_wait_s: {rows[0]?.wait_seconds || 'N/A'}
      </div>
    </div>
  )
}

export default StopDetailPage