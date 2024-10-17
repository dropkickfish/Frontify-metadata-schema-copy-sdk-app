'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Checkbox } from "../components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog"
import { RefreshCw, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import { Skeleton } from "../components/ui/skeleton"
import { Label } from "../components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip"

import { createNewMetadataFields, checkExistingMetadataFields, getLibraries, getMetadataFields } from '../helpers/frontifyQueries'

import { appContext } from '@frontify/app-bridge-app';

export function MetadataManager() {
  const context = appContext();

  const [libraries, setLibraries] = useState([])
  const [metadataFields, setMetadataFields] = useState([])
  const [selectedLibrary, setSelectedLibrary] = useState(null)
  const [selectedMetadata, setSelectedMetadata] = useState([])
  const [expandedMetadata, setExpandedMetadata] = useState({})
  const [librarySearch, setLibrarySearch] = useState('')
  const [metadataSearch, setMetadataSearch] = useState('')
  const [optionSearches, setOptionSearches] = useState({})
  const [selectedOptions, setSelectedOptions] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isLibrariesLoading, setIsLibrariesLoading] = useState(true)
  const [isMetadataLoading, setIsMetadataLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [overwriteExisting, setOverwriteExisting] = useState(true)
  const [showWarning, setShowWarning] = useState(false)
  const [warningMessage, setWarningMessage] = useState('')

  const fetchLibraries = useCallback(async () => {
    setIsLibrariesLoading(true)
    setSelectedMetadata([])
    setSelectedLibrary(null)
    try {
      setMetadataFields([])
      const data = await getLibraries()
      setLibraries(data)
    } catch (error) {
      console.error('Error fetching libraries:', error)
    } finally {
      setIsLibrariesLoading(false)
    }
  }, [])

  const fetchMetadataFields = useCallback(async () => {
    setIsMetadataLoading(true)
    try {
      console.log('Fetching metadata fields for library:', selectedLibrary.id)
      const data = await getMetadataFields(selectedLibrary.id)
      setMetadataFields(data)
    } catch (error) {
      console.error('Error fetching metadata fields:', error)
    } finally {
      setIsMetadataLoading(false)
    }
  }, [selectedLibrary])

  useEffect(() => {
    fetchLibraries()
  }, [fetchLibraries])

  // For debugging, log selectedMetadataFields when changed
  useEffect(() => {
    console.log('selected metadata', selectedMetadata)
  }, [selectedMetadata])

  useEffect(() => {
    console.log('metadata fields', metadataFields)
  }, [metadataFields])

  useEffect(() => {
    console.log('selected options', selectedOptions)
  }, [selectedOptions])
  // end debugging

  useEffect(() => {
    if (selectedLibrary) {
      console.log(selectedLibrary)
      fetchMetadataFields(selectedLibrary.id)
    }
  }, [selectedLibrary, fetchMetadataFields])

  const filteredLibraries = libraries.filter(lib => 
    lib.name.toLowerCase().includes(librarySearch.toLowerCase())
  )

  const filteredMetadata = metadataFields.filter(field => 
    field.name.toLowerCase().includes(metadataSearch.toLowerCase())
  )

  const handleLibrarySelect = (library) => {
    setSelectedLibrary(library)
    setSelectedMetadata([])
    setExpandedMetadata({})
    setSelectedOptions({})
  }

  const handleMetadataSelect = (metadata) => {
    setSelectedMetadata(prev => {
      if (prev.includes(metadata.id)) {
        // If deselecting, remove the options
        setSelectedOptions(prevOptions => {
          const { [metadata.id]: _, ...rest } = prevOptions
          return rest
        })
        return prev.filter(id => id !== metadata.id)
      } else {
        // If selecting, add all options by default
        if (metadata.type === 'SELECT' || metadata.type === 'MULTISELECT') {
          setSelectedOptions(prevOptions => ({
            ...prevOptions,
            [metadata.id]: metadata.options
          }))
        }
        return [...prev, metadata.id]
      }
    })
  }

  const handleExpandMetadata = (metadata) => {
    setExpandedMetadata(prev => ({
      ...prev,
      [metadata.id]: !prev[metadata.id]
    }))
    if (!selectedOptions[metadata.id] && (metadata.type === 'SELECT' || metadata.type === 'MULTISELECT')) {
      setSelectedOptions(prev => ({
        ...prev,
        [metadata.id]: metadata.options
      }))
    }
  }

  const handleOptionSelect = (metadataId, option) => {
    setSelectedOptions(prev => ({
      ...prev,
      [metadataId]: prev[metadataId].includes(option)
        ? prev[metadataId].filter(o => o !== option)
        : [...prev[metadataId], option]
    }))
  }

  const handleSelectAllOptions = (metadataId) => {
    const metadata = metadataFields.find(f => f.id === metadataId)
    setSelectedOptions(prev => ({
      ...prev,
      [metadataId]: metadata.options
    }))
  }

  const handleDeselectAllOptions = (metadataId) => {
    setSelectedOptions(prev => ({
      ...prev,
      [metadataId]: []
    }))
  }

  const handleSelectAllMetadata = () => {
    const allMetadataIds = metadataFields.map(f => f.id)
    setSelectedMetadata(allMetadataIds)
    const newSelectedOptions = {}
    metadataFields.forEach(field => {
      if (field.type === 'SELECT' || field.type === 'MULTISELECT') {
        newSelectedOptions[field.id] = field.options
      }
    })
    setSelectedOptions(newSelectedOptions)
  }

  const handleDeselectAllMetadata = () => {
    setSelectedMetadata([])
    setSelectedOptions({})
  }

  const validateMetadataSelection = () => {
    const invalidFields = selectedMetadata.filter(id => {
      const field = metadataFields.find(f => f.id === id)
      return (field.type === 'SELECT' || field.type === 'MULTISELECT') && 
             (!selectedOptions[id] || selectedOptions[id].length === 0)
    })

    if (invalidFields.length > 0) {
      const fieldNames = invalidFields.map(id => metadataFields.find(f => f.id === id).name).join(', ')
      setWarningMessage(`The following fields have no options selected: ${fieldNames}`)
      setShowWarning(true)
      return false
    }
    return true
  }

  const handleApplyMetadata = () => {
    if (!validateMetadataSelection()) {
      return
    }

    setIsLoading(true)
    if (overwriteExisting){
      checkExistingMetadataFields(context.parentId, metadataFields, selectedMetadata, selectedOptions)
    } else {
      createNewMetadataFields(context.parentId, metadataFields, selectedMetadata, selectedOptions)
    }
    setShowConfirmation(true)
    setIsLoading(false)
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Metadata schema duplicator</h1>
      <p>Copy metadata fields and options from source libraries to this library</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Source Library</CardTitle>
            <Button variant="outline" size="icon" onClick={fetchLibraries} disabled={isLibrariesLoading}>
              <RefreshCw className={`h-4 w-4 ${isLibrariesLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            <Input 
              placeholder="Search asset libraries" 
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="mb-2"
            />
            <div className="space-y-2 h-[300px] overflow-y-auto pr-2">
              {isLibrariesLoading ? (
                Array(5).fill(0).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))
              ) : (
                filteredLibraries.map(library => (
                  <Card 
                    key={library.id} 
                    className={`cursor-pointer ${selectedLibrary?.id === library.id ? 'border-primary' : ''}`}
                    onClick={() => handleLibrarySelect(library)}
                  >
                    <CardContent className="p-4">
                      {library.name}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Metadata Fields</CardTitle>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={fetchMetadataFields} 
              disabled={isMetadataLoading || !selectedLibrary}
            >
              <RefreshCw className={`h-4 w-4 ${isMetadataLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Input 
                placeholder="Search metadata fields" 
                value={metadataSearch}
                onChange={(e) => setMetadataSearch(e.target.value)}
                className="w-full"
              />
              <div className="flex justify-start space-x-2">
                <Button variant="outline" onClick={handleSelectAllMetadata}>
                  Select All
                </Button>
                <Button variant="outline" onClick={handleDeselectAllMetadata}>
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="space-y-2 mt-4 h-[300px] overflow-y-auto pr-2">
              {isMetadataLoading ? (
                Array(5).fill(0).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))
              ) : (
                filteredMetadata.map(metadata => (
                  <Card 
                    key={metadata.id} 
                    className={`cursor-pointer ${selectedMetadata.includes(metadata.id) ? 'border-primary' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <Checkbox 
                            checked={selectedMetadata.includes(metadata.id)}
                            onCheckedChange={() => handleMetadataSelect(metadata)}
                            id={`metadata-${metadata.id}`}
                          />
                          <label htmlFor={`metadata-${metadata.id}`} className="ml-2 cursor-pointer">
                            {metadata.name}
                          </label>
                        </div>
                        {(metadata.type === 'SELECT' || metadata.type === 'MULTISELECT') && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleExpandMetadata(metadata)}
                          >
                            {expandedMetadata[metadata.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                      {expandedMetadata[metadata.id] && (
                        <div className="mt-2">
                          <div className="flex justify-between items-center mb-2">
                            <Input 
                              placeholder={`Search ${metadata.name} options`}
                              className="w-full mr-2"
                              value={optionSearches[metadata.id] || ''}
                              onChange={(e) => setOptionSearches(prev => ({...prev, [metadata.id]: e.target.value}))}
                            />
                          </div>
                          <div className="flex justify-start space-x-2 mb-2">
                            <Button variant="outline" size="sm" onClick={() => handleSelectAllOptions(metadata.id)}>
                              Select All
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeselectAllOptions(metadata.id)}>
                              Deselect All
                            </Button>
                          </div>
                          {metadata.options
                            .filter(option => option.toLowerCase().includes((optionSearches[metadata.id] || '').toLowerCase()))
                            .map((option, index) => (
                              <div key={index} className="flex items-center">
                                <Checkbox 
                                  checked={selectedOptions[metadata.id]?.includes(option)}
                                  onCheckedChange={() => handleOptionSelect(metadata.id, option)}
                                  id={`${metadata.id}-${index}`} 
                                />
                                <label htmlFor={`${metadata.id}-${index}`} className="ml-2 cursor-pointer">{option}</label>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 flex items-center space-x-4">
        <Button 
          variant="outline"
          onClick={handleApplyMetadata} 
          disabled={!selectedLibrary || selectedMetadata.length === 0 || isLoading}
        >
          {isLoading
          ? 'Applying...'
          : selectedLibrary
          ? `Copy metadata fields from ${selectedLibrary.name}`
          : 'Copy metadata'}
        </Button>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="overwrite"
            checked={overwriteExisting}
            onCheckedChange={setOverwriteExisting}
          />
          <Label htmlFor="overwrite">Merge with existing metadata fields
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>If checked, any matching Select and Multi-Select fields in the destination library will have additional options created if applicable, and any other matching fields will be skipped.</p>
                  <br />
                  <p>If unchecked, it will create all selected metadata fields and options, regardless of whether or not it causes duplicates</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
        </div>
      </div>
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Metadata Applied</DialogTitle>
            <DialogDescription>
              The following metadata fields have been copied from {selectedLibrary?.name}:
              <ul className="list-disc list-inside mt-2">
                {selectedMetadata.map(id => (
                  <li key={id}>{metadataFields.find(f => f.id === id).name}</li>
                ))}
              </ul>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Warning</DialogTitle>
            <DialogDescription>
              {warningMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowWarning(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}