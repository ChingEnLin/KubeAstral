import React from 'react';

export interface FilterState {
    selectedNamespaces: string[];
    hideSystem: boolean;
    searchQuery: string;
}

interface FilterPanelProps {
    namespaces: string[];
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
    namespaces,
    filters,
    onFilterChange,
    isOpen,
    onClose
}) => {
    if (!isOpen) return null;

    // Helper to toggle a namespace
    const toggleNamespace = (ns: string) => {
        const currentData = new Set(filters.selectedNamespaces);
        if (currentData.has(ns)) {
            currentData.delete(ns);
        } else {
            currentData.add(ns);
        }
        onFilterChange({
            ...filters,
            selectedNamespaces: Array.from(currentData)
        });
    };

    const toggleAll = () => {
        if (filters.selectedNamespaces.length === namespaces.length) {
            // Deselect all
            onFilterChange({ ...filters, selectedNamespaces: [] });
        } else {
            // Select all
            onFilterChange({ ...filters, selectedNamespaces: [...namespaces] });
        }
    };

    return (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 text-gray-800 font-sans">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full relative max-h-[80vh] flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    ✕
                </button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="text-blue-600">Filters</span>
                </h2>

                <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Search Section */}
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                            Search Objects
                        </label>
                        <input
                            type="text"
                            placeholder="Search pods, workloads..."
                            value={filters.searchQuery}
                            onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none transition-all"
                        />
                    </div>

                    {/* System Objects Toggle */}
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <span className="text-sm font-medium text-gray-700">Hide System Objects</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filters.hideSystem}
                                onChange={(e) => onFilterChange({ ...filters, hideSystem: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {/* Namespace Selection */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Namespaces
                            </label>
                            <button
                                onClick={toggleAll}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                {filters.selectedNamespaces.length === namespaces.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto bg-gray-50 p-2 rounded border border-gray-100">
                            {namespaces.map(ns => (
                                <label key={ns} className="flex items-center p-2 rounded hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={filters.selectedNamespaces.includes(ns)}
                                        onChange={() => toggleNamespace(ns)}
                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700 truncate">{ns}</span>
                                </label>
                            ))}
                            {namespaces.length === 0 && (
                                <div className="text-xs text-gray-400 text-center py-4">No namespaces found</div>
                            )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 text-right">
                            {filters.selectedNamespaces.length} selected
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg shadow-lg text-sm transition-all transform hover:scale-105"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
};
