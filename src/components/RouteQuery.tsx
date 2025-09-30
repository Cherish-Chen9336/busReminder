import { useState } from 'react';
import { getRouteStops, getRouteIdByShortName } from '../lib/supabase';

interface RouteStop {
  order_no?: number;
  stop_sequence?: number;
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  trip_id?: string;
  shape_id?: string;
  direction_id?: number;
  route_id?: string;
}

interface RouteInfo {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
}

interface RouteQueryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RouteQuery({ isOpen, onClose }: RouteQueryProps) {
  const [routeInput, setRouteInput] = useState('');
  const [direction, setDirection] = useState<number | null>(null);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{success: boolean, message: string, data?: any, error?: string} | null>(null);

  const handleQuery = async () => {
    if (!routeInput.trim()) {
      setError('Please enter route number or route ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRouteStops([]);
    setRouteInfo(null);

    try {
      let routeId = routeInput.trim();
      
      // If input looks like a route number (alphanumeric short text), try to find route_id first
      if (/^[A-Za-z0-9]+$/.test(routeInput.trim()) && routeInput.trim().length <= 10) {
        console.log('Input looks like route number, trying to find route_id...');
        try {
          const routeResults = await getRouteIdByShortName(routeInput.trim()) as RouteInfo[];
          
          if (routeResults && routeResults.length > 0) {
            routeId = routeResults[0].route_id;
            setRouteInfo(routeResults[0]);
            console.log('Found corresponding route_id:', routeId);
          } else {
            console.log('No corresponding route_id found, using input as route_id directly');
          }
        } catch (routeErr) {
          console.log('Error finding route by short name, using input as route_id directly:', routeErr);
        }
      }

      // Call route_stops to get stop information
      console.log('Querying route stops with parameters:', { routeId, serviceDate, direction });
      const stops = await getRouteStops(routeId) as RouteStop[];
      
      console.log('Raw stops data received:', stops);
      
      if (stops && Array.isArray(stops) && stops.length > 0) {
        setRouteStops(stops);
        console.log('Successfully retrieved stop information:', stops.length, 'stops');
      } else {
        setError(`No stops found for route "${routeId}". Please check if the route exists or try a different route number/ID.`);
      }
    } catch (err) {
      console.error('Failed to query route stops:', err);
      setError(`Query failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    setIsHealthChecking(true);
    setHealthStatus(null);
    
    try {
      // Test with a common route ID like F11
      console.log('Performing health check, testing database connection with F11 route...');
      
      const result = await getRouteStops('F11') as RouteStop[];
      
      if (result && Array.isArray(result)) {
        if (result.length > 0) {
          setHealthStatus({
            success: true,
            message: `Health check successful: Found ${result.length} stops for F11 route`,
            data: result.slice(0, 3) // Only show first 3 stops as example
          });
        } else {
          setHealthStatus({
            success: true,
            message: 'Health check successful: Connected to database but F11 route has no stops',
            error: 'F11 route might not exist or have no stops'
          });
        }
      } else {
        setHealthStatus({
          success: false,
          message: 'Health check failed: Invalid response format',
          error: 'Expected array but got different data type'
        });
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({
        success: false,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsHealthChecking(false);
    }
  };

  const clearResults = () => {
    setRouteStops([]);
    setRouteInfo(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Get Route Stops by Line</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Health Check */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">System Health Check</h3>
              <button
                onClick={handleHealthCheck}
                disabled={isHealthChecking}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isHealthChecking ? 'Checking...' : 'Test Connection'}
              </button>
            </div>
            
            {healthStatus && (
              <div className={`p-3 rounded-lg ${
                healthStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className={`font-medium ${
                  healthStatus.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {healthStatus.success ? '✅' : '❌'} {healthStatus.message}
                </div>
                {healthStatus.error && (
                  <div className="text-red-600 text-sm mt-1">
                    Error: {healthStatus.error}
                  </div>
                )}
                {healthStatus.data && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700">
                      View Test Data
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {JSON.stringify(healthStatus.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Query Form */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Route Number or Route ID *
              </label>
              <input
                type="text"
                value={routeInput}
                onChange={(e) => setRouteInput(e.target.value)}
                placeholder="e.g.: 8, F11, or complete route_id"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Supports entering route number (e.g. "8") or complete route ID (e.g. "F11")
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Direction (Optional)
                </label>
                <select
                  value={direction || ''}
                  onChange={(e) => setDirection(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No Direction Filter</option>
                  <option value="0">Direction 0</option>
                  <option value="1">Direction 1</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Date
                </label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleQuery}
                disabled={isLoading || !routeInput.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Querying...' : 'Get Route Stops'}
              </button>
              
              <button
                onClick={clearResults}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Clear Results
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-800 font-medium">⚠️ Error</div>
              <div className="text-red-700 text-sm mt-1">{error}</div>
            </div>
          )}

          {/* Route Information */}
          {routeInfo && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-blue-800 font-medium">📋 Route Information</div>
              <div className="text-blue-700 text-sm mt-1">
                <div>Route ID: {routeInfo.route_id}</div>
                <div>Route Number: {routeInfo.route_short_name}</div>
                <div>Route Name: {routeInfo.route_long_name}</div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-2">Querying route stops...</p>
            </div>
          )}

          {/* Stop List */}
          {routeStops.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Stop List ({routeStops.length} stops)
                </h3>
                <div className="text-sm text-gray-500">
                  Sorted by stop sequence
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {routeStops.map((stop, index) => (
                    <div key={`${stop.trip_id}-${stop.stop_id}`} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {stop.order_no || stop.stop_sequence || index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{stop.stop_name}</div>
                          <div className="text-sm text-gray-500">
                            Stop ID: {stop.stop_id} • 
                            {stop.direction_id !== undefined && `Direction: ${stop.direction_id} • `}
                            {stop.trip_id && `Trip ID: ${stop.trip_id}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <div>Latitude: {stop.stop_lat?.toFixed(6)}</div>
                        <div>Longitude: {stop.stop_lon?.toFixed(6)}</div>
                        {stop.shape_id && (
                          <div>Shape ID: {stop.shape_id}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="font-medium text-blue-800">Total Stops</div>
                  <div className="text-2xl font-bold text-blue-600">{routeStops.length}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="font-medium text-green-800">Direction</div>
                  <div className="text-2xl font-bold text-green-600">
                    {routeStops[0]?.direction_id ?? 'N/A'}
                  </div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <div className="font-medium text-purple-800">Route ID</div>
                  <div className="text-xs font-bold text-purple-600 truncate">
                    {routeStops[0]?.route_id ?? 'N/A'}
                  </div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <div className="font-medium text-orange-800">Service Date</div>
                  <div className="text-sm font-bold text-orange-600">
                    {serviceDate}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No Results State */}
          {!isLoading && routeInput && routeStops.length === 0 && !error && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🚌</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Stops Found</h3>
              <p className="text-gray-600 mb-4">
                Please check if the route operates today, or if you selected the correct direction or service date
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Troubleshooting Tips:</p>
                <ul className="text-left max-w-md mx-auto space-y-1">
                  <li>• Confirm the route number or route ID is correct</li>
                  <li>• Check if the selected service date has operations</li>
                  <li>• Try clearing the direction filter</li>
                  <li>• Use the health check function to test connection</li>
                  <li>• Check browser console for detailed error messages</li>
                </ul>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                <p className="text-sm text-yellow-800 font-medium">Debug Information:</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Input: "{routeInput}" | Direction: {direction || 'None'} | Date: {serviceDate}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
