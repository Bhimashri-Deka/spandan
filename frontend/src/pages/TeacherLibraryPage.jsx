import React, { useState, useEffect } from 'react'
import useAuthStore from '../stores/authStore'
import Sidebar from '../components/Sidebar'
import ThemeToggle from '../components/ThemeToggle'
import ProfileDropdown from '../components/ProfileDropdown'
import { API_URL } from '../config.js'

export default function TeacherLibraryPage() {
  const { user, token } = useAuthStore()
  
  // State
  const [hierarchy, setHierarchy] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Selection
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [selectedTopicId, setSelectedTopicId] = useState(null)
  
  // Modals / Modifiers
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderModalType, setFolderModalType] = useState('session') // 'session' | 'topic'
  const [folderAction, setFolderAction] = useState('create') // 'create' | 'edit'
  const [editingFolderId, setEditingFolderId] = useState(null)
  const [folderName, setFolderName] = useState('')
  
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [resourceAction, setResourceAction] = useState('create') // 'create' | 'edit'
  const [editingResourceId, setEditingResourceId] = useState(null)
  
  // Resource Form State
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceType, setResourceType] = useState('pdf')
  const [resourceLink, setResourceLink] = useState('') // URL if link/video/github
  const [resourceTags, setResourceTags] = useState('') // comma-separated strings
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null) // { url, fileKey }
  
  // Drag and Drop active indicators
  const [draggingType, setDraggingType] = useState(null) // 'session' | 'topic' | 'resource'
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverTopicId, setDragOverTopicId] = useState(null)

  useEffect(() => {
    if (token) {
      fetchLibrary()
    }
  }, [token])

  const fetchLibrary = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/resources/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setHierarchy(data.hierarchy || [])
        
        // Auto-select first session and topic if none selected
        if (data.hierarchy && data.hierarchy.length > 0) {
          if (!selectedSessionId) {
            setSelectedSessionId(data.hierarchy[0]._id)
            if (data.hierarchy[0].topics && data.hierarchy[0].topics.length > 0) {
              setSelectedTopicId(data.hierarchy[0].topics[0]._id)
            }
          }
        }
      } else {
        setError(data.error || 'Failed to fetch library structure')
      }
    } catch (err) {
      console.error(err)
      setError('Network error fetching library')
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // Folder Handlers (Session & Topic CRUD)
  // ==========================================
  const handleOpenFolderModal = (type, action, id = null, currentVal = '') => {
    setFolderModalType(type)
    setFolderAction(action)
    setEditingFolderId(id)
    setFolderName(currentVal)
    setShowFolderModal(true)
  }

  const handleFolderSubmit = async (e) => {
    e.preventDefault()
    if (!folderName.trim()) return

    try {
      let endpoint = `${API_URL}/resources/sessions`
      let method = 'POST'
      let body = { name: folderName.trim() }

      if (folderModalType === 'topic') {
        endpoint = `${API_URL}/resources/topics`
        body = { name: folderName.trim(), sessionId: selectedSessionId }
      }

      if (folderAction === 'edit') {
        endpoint = `${API_URL}/resources/${folderModalType === 'session' ? 'sessions' : 'topics'}/${editingFolderId}`
        method = 'PUT'
        body = { name: folderName.trim() }
      }

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      const data = await res.json()

      if (data.success) {
        setShowFolderModal(false)
        setFolderName('')
        fetchLibrary()
      } else {
        alert(data.error || 'Error processing folder operation')
      }
    } catch (err) {
      console.error(err)
      alert('Network error processing folder')
    }
  }

  const handleFolderDelete = async (type, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${type === 'session' ? 'Session folder' : 'Topic subfolder'}? This will delete all subfolders and resource files inside it!`)) {
      return
    }

    try {
      const endpoint = `${API_URL}/resources/${type === 'session' ? 'sessions' : 'topics'}/${id}`
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()

      if (data.success) {
        if (type === 'session' && selectedSessionId === id) {
          setSelectedSessionId(null)
          setSelectedTopicId(null)
        } else if (type === 'topic' && selectedTopicId === id) {
          setSelectedTopicId(null)
        }
        fetchLibrary()
      } else {
        alert(data.error || 'Failed to delete folder')
      }
    } catch (err) {
      console.error(err)
      alert('Network error deleting folder')
    }
  }

  // ==========================================
  // Resource Handlers (Resource CRUD & Upload)
  // ==========================================
  const handleOpenResourceModal = (action, resItem = null) => {
    setResourceAction(action)
    if (action === 'edit' && resItem) {
      setEditingResourceId(resItem._id)
      setResourceTitle(resItem.title)
      setResourceType(resItem.type)
      setResourceLink(['link', 'youtube', 'github'].includes(resItem.type) ? resItem.url : '')
      setResourceTags(resItem.tags ? resItem.tags.join(', ') : '')
      setUploadedFileInfo(resItem.fileKey ? { url: resItem.url, fileKey: resItem.fileKey } : null)
    } else {
      setEditingResourceId(null)
      setResourceTitle('')
      setResourceType('pdf')
      setResourceLink('')
      setResourceTags('')
      setUploadedFileInfo(null)
    }
    setShowResourceModal(true)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingFile(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_URL}/resources/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      const data = await res.json()

      if (data.success) {
        setUploadedFileInfo({ url: data.url, fileKey: data.fileKey })
        if (!resourceTitle) {
          // Pre-populate title from file name
          const dotIdx = data.fileName.lastIndexOf('.')
          const cleanName = dotIdx !== -1 ? data.fileName.substring(0, dotIdx) : data.fileName
          setResourceTitle(cleanName)
        }
      } else {
        alert(data.error || 'File upload failed')
      }
    } catch (err) {
      console.error(err)
      alert('Network error uploading file')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleResourceSubmit = async (e) => {
    e.preventDefault()
    if (!resourceTitle.trim()) return

    const isLinkType = ['link', 'youtube', 'github'].includes(resourceType)
    const finalUrl = isLinkType ? resourceLink.trim() : (uploadedFileInfo?.url || '')
    const finalFileKey = isLinkType ? '' : (uploadedFileInfo?.fileKey || '')

    if (!finalUrl) {
      alert(isLinkType ? 'Please specify resource link URL' : 'Please upload a resource file first')
      return
    }

    try {
      const tagsArray = resourceTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      let endpoint = `${API_URL}/resources`
      let method = 'POST'
      let body = {
        title: resourceTitle.trim(),
        topicId: selectedTopicId,
        type: resourceType,
        url: finalUrl,
        fileKey: finalFileKey,
        tags: tagsArray
      }

      if (resourceAction === 'edit') {
        endpoint = `${API_URL}/resources/${editingResourceId}`
        method = 'PUT'
        body = {
          title: resourceTitle.trim(),
          type: resourceType,
          url: finalUrl,
          fileKey: finalFileKey,
          tags: tagsArray
        }
      }

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      const data = await res.json()

      if (data.success) {
        setShowResourceModal(false)
        fetchLibrary()
      } else {
        alert(data.error || 'Failed to submit resource')
      }
    } catch (err) {
      console.error(err)
      alert('Network error submitting resource')
    }
  }

  const handleResourceDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`${API_URL}/resources/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()

      if (data.success) {
        fetchLibrary()
      } else {
        alert(data.error || 'Failed to delete resource')
      }
    } catch (err) {
      console.error(err)
      alert('Network error deleting resource')
    }
  }

  // ==========================================
  // HTML5 Drag and Drop Functions
  // ==========================================
  const handleDragStart = (e, type, id) => {
    setDraggingType(type)
    setDraggingId(id)
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e, type, targetId = null) => {
    e.preventDefault()
    if (draggingType === 'resource' && type === 'topic') {
      setDragOverTopicId(targetId)
    }
  }

  const handleDragLeave = () => {
    setDragOverTopicId(null)
  }

  const handleDrop = async (e, type, targetId) => {
    e.preventDefault()
    setDragOverTopicId(null)
    const sourceId = e.dataTransfer.getData('text/plain')

    if (!sourceId || sourceId === targetId) return

    // 1. Move resource across topics
    if (draggingType === 'resource' && type === 'topic') {
      try {
        const res = await fetch(`${API_URL}/resources/move`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ resourceId: sourceId, topicId: targetId })
        })
        const data = await res.json()
        if (data.success) {
          fetchLibrary()
        }
      } catch (err) {
        console.error('Failed to move resource:', err)
      }
    }

    // 2. Reorder elements of the same type
    if (draggingType === type) {
      let itemsList = []
      if (type === 'session') {
        itemsList = [...hierarchy]
      } else if (type === 'topic') {
        const currentSession = hierarchy.find(s => s._id === selectedSessionId)
        if (!currentSession) return
        itemsList = [...currentSession.topics]
      } else if (type === 'resource') {
        const currentSession = hierarchy.find(s => s._id === selectedSessionId)
        if (!currentSession) return
        const currentTopic = currentSession.topics.find(t => t._id === selectedTopicId)
        if (!currentTopic) return
        itemsList = [...currentTopic.resources]
      }

      const draggedIndex = itemsList.findIndex(item => item._id === sourceId)
      const targetIndex = itemsList.findIndex(item => item._id === targetId)
      if (draggedIndex === -1 || targetIndex === -1) return

      // Reorder locally
      const [movedItem] = itemsList.splice(draggedIndex, 1)
      itemsList.splice(targetIndex, 0, movedItem)

      // Construct payload
      const orders = itemsList.map((item, idx) => ({ id: item._id, order: idx }))

      try {
        const res = await fetch(`${API_URL}/resources/reorder`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ type, orders })
        })
        const data = await res.json()
        if (data.success) {
          fetchLibrary()
        }
      } catch (err) {
        console.error('Failed to reorder:', err)
      }
    }

    setDraggingType(null)
    setDraggingId(null)
  }

  // Get active items
  const activeSession = hierarchy.find(s => s._id === selectedSessionId)
  const activeTopic = activeSession?.topics?.find(t => t._id === selectedTopicId)
  const activeResources = activeTopic?.resources || []

  // Icon selector based on type
  const getResourceIcon = (type) => {
    switch (type) {
      case 'pdf': return '📄'
      case 'ppt': return '📊'
      case 'doc': return '📝'
      case 'image': return '🖼️'
      case 'youtube': return '🎥'
      case 'github': return '💻'
      default: return '🔗'
    }
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
    }}>
      <Sidebar user={user} />

      {/* Main Container */}
      <div style={{ flex: 1, marginLeft: '240px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <header style={{
          background: 'var(--header-bg)',
          color: 'white',
          padding: '24px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>📚 Learning Library Management</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>
              Create folders and upload course assets for students
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ThemeToggle />
            <ProfileDropdown />
          </div>
        </header>

        {/* Library Layout split into Left Sidebar (Folders) and Right Workspace (Resources) */}
        <div style={{ flex: 1, display: 'flex', minHeight: 'calc(100vh - 90px)' }}>
          
          {/* Folders Navigation */}
          <div style={{
            width: '320px',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-color)',
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>FONDATIONS / SESSIONS</h3>
              <button 
                onClick={() => handleOpenFolderModal('session', 'create')}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-1.5 text-xs font-semibold flex items-center gap-1 transition"
              >
                ➕ Session
              </button>
            </div>

            {loading && hierarchy.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>
                Loading folder hierarchy...
              </div>
            ) : hierarchy.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>
                No sessions created. Create one to begin.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {hierarchy.map(session => (
                  <div 
                    key={session._id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'session', session._id)}
                    onDragOver={(e) => handleDragOver(e, 'session')}
                    onDrop={(e) => handleDrop(e, 'session', session._id)}
                    style={{
                      border: selectedSessionId === session._id ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                      borderRadius: '12px',
                      background: selectedSessionId === session._id ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-card)',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Session Heading */}
                    <div 
                      onClick={() => {
                        setSelectedSessionId(session._id)
                        if (session.topics && session.topics.length > 0) {
                          setSelectedTopicId(session.topics[0]._id)
                        } else {
                          setSelectedTopicId(null)
                        }
                      }}
                      style={{
                        padding: '12px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <span className="flex items-center gap-2 truncate">
                        📁 {session.name}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                        <button 
                          title="Rename Folder"
                          onClick={() => handleOpenFolderModal('session', 'edit', session._id, session.name)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.7 }}
                        >
                          ✏️
                        </button>
                        <button 
                          title="Delete Folder"
                          onClick={() => handleFolderDelete('session', session._id)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.7 }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Subtopics (Nested List) */}
                    {selectedSessionId === session._id && (
                      <div style={{ 
                        background: 'rgba(0,0,0,0.01)', 
                        borderTop: '1px solid var(--border-color)',
                        padding: '10px 10px 10px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>SUBTOPICS</span>
                          <button 
                            onClick={() => handleOpenFolderModal('topic', 'create')}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: '#3b82f6', fontWeight: '600' }}
                          >
                            ➕ Topic
                          </button>
                        </div>

                        {session.topics?.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 0' }}>
                            No topics. Click "➕ Topic"
                          </div>
                        ) : (
                          session.topics?.map(topic => {
                            const isOver = dragOverTopicId === topic._id
                            return (
                              <div
                                key={topic._id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, 'topic', topic._id)}
                                onDragOver={(e) => handleDragOver(e, 'topic', topic._id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 'topic', topic._id)}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedTopicId(topic._id)
                                }}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: selectedTopicId === topic._id 
                                    ? '#3b82f6' 
                                    : isOver 
                                      ? 'rgba(59, 130, 246, 0.2)' 
                                      : 'transparent',
                                  color: selectedTopicId === topic._id ? 'white' : 'var(--text-primary)',
                                  border: isOver ? '1.5px dashed #3b82f6' : '1.5px solid transparent',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <span className="truncate">🏷️ {topic.name}</span>
                                <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                  <button 
                                    onClick={() => handleOpenFolderModal('topic', 'edit', topic._id, topic.name)}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', filter: selectedTopicId === topic._id ? 'brightness(10)' : 'none' }}
                                  >
                                    ✏️
                                  </button>
                                  <button 
                                    onClick={() => handleFolderDelete('topic', topic._id)}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', filter: selectedTopicId === topic._id ? 'brightness(10)' : 'none' }}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resources Workspace */}
          <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
            {selectedTopicId ? (
              <div>
                {/* Topic Header bar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '20px',
                  borderBottom: '1px solid var(--border-color)',
                  marginBottom: '24px'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase' }}>
                      {activeSession?.name}
                    </div>
                    <h2 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Topic: {activeTopic?.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => handleOpenResourceModal('create')}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 font-semibold text-sm shadow-md transition flex items-center gap-1.5"
                  >
                    <span>➕ Add Resource</span>
                  </button>
                </div>

                {/* Resources Grid */}
                {activeResources.length === 0 ? (
                  <div style={{
                    padding: '80px 0',
                    textAlign: 'center',
                    border: '2px dashed var(--border-color)',
                    borderRadius: '16px',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                    <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)' }}>No resources found</h3>
                    <p style={{ margin: 0, fontSize: '13px' }}>Click "Add Resource" to upload course materials for this topic.</p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '20px'
                  }}>
                    {activeResources.map((resItem) => (
                      <div
                        key={resItem._id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'resource', resItem._id)}
                        onDragOver={(e) => handleDragOver(e, 'resource')}
                        onDrop={(e) => handleDrop(e, 'resource', resItem._id)}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '14px',
                          padding: '18px',
                          boxShadow: 'var(--card-shadow)',
                          cursor: 'grab',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '14px',
                          transition: 'transform 0.15s ease'
                        }}
                      >
                        {/* Upper Section */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <span style={{ fontSize: '24px' }}>{getResourceIcon(resItem.type)}</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => handleOpenResourceModal('edit', resItem)}
                                style={{ border: 'none', background: 'rgba(0,0,0,0.04)', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleResourceDelete(resItem._id)}
                                style={{ border: 'none', background: 'rgba(0,0,0,0.04)', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          <h3 style={{
                            margin: '12px 0 6px',
                            fontSize: '15px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            lineHeight: '1.4'
                          }}>
                            {resItem.title}
                          </h3>

                          {/* Resource Type Tag */}
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}>
                            {resItem.type}
                          </span>
                        </div>

                        {/* Lower Section (Tags and link button) */}
                        <div>
                          {resItem.tags && resItem.tags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                              {resItem.tags.map((tag, idx) => (
                                <span key={idx} style={{
                                  fontSize: '10px',
                                  color: 'var(--text-secondary)',
                                  background: 'var(--bg-primary)',
                                  border: '1px solid var(--border-color)',
                                  padding: '2px 6px',
                                  borderRadius: '20px'
                                }}>
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <a
                            href={resItem.url.startsWith('/') ? `${API_URL.replace('/api', '')}${resItem.url}` : resItem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold py-2 rounded-lg transition block"
                          >
                            Open / Download Resource
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                padding: '40px 0'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>📁</div>
                <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)' }}>Select a folder</h3>
                <p style={{ margin: 0, fontSize: '13px' }}>Select a topic folder from the sidebar tree to manage its resource assets.</p>
              </div>
            )}
          </div>
        </div>

        {/* ==========================================
            MODAL 1: Folder Create/Edit
            ========================================== */}
        {showFolderModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              width: '400px',
              padding: '24px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {folderAction === 'create' ? 'Create' : 'Rename'} {folderModalType === 'session' ? 'Session Folder' : 'Topic Subfolder'}
              </h3>
              <form onSubmit={handleFolderSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    FOLDER NAME
                  </label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder={folderModalType === 'session' ? 'e.g. Session 1: Express Basics' : 'e.g. Topic A: Router'}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowFolderModal(false)}
                    className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow"
                  >
                    {folderAction === 'create' ? 'Create Folder' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==========================================
            MODAL 2: Resource Upload/Link Create/Edit
            ========================================== */}
        {showResourceModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              width: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {resourceAction === 'create' ? 'Add Learning Resource' : 'Edit Resource'}
              </h3>
              
              <form onSubmit={handleResourceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    TITLE
                  </label>
                  <input
                    type="text"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    placeholder="Enter resource title"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {/* Resource Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    RESOURCE TYPE
                  </label>
                  <select
                    value={resourceType}
                    onChange={(e) => {
                      setResourceType(e.target.value)
                      // Reset file/links when switching type
                      setUploadedFileInfo(null)
                      setResourceLink('')
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      outline: 'none',
                      fontSize: '14px',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="pdf">📄 PDF Document</option>
                    <option value="ppt">📊 PowerPoint Presentation</option>
                    <option value="doc">📝 Word Document</option>
                    <option value="image">🖼️ Image Asset</option>
                    <option value="link">🔗 Web URL / External Link</option>
                    <option value="youtube">🎥 YouTube Video Link</option>
                    <option value="github">💻 GitHub Repository</option>
                  </select>
                </div>

                {/* URL or Upload fields conditional on type selection */}
                {['link', 'youtube', 'github'].includes(resourceType) ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      LINK URL
                    </label>
                    <input
                      type="url"
                      value={resourceLink}
                      onChange={(e) => setResourceLink(e.target.value)}
                      placeholder={resourceType === 'github' ? 'https://github.com/user/repo' : 'https://example.com/resource'}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        outline: 'none',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      UPLOAD FILE
                    </label>
                    <div style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center',
                      background: 'var(--bg-primary)'
                    }}>
                      {uploadingFile ? (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          ⏳ Uploading file to storage engine...
                        </div>
                      ) : uploadedFileInfo ? (
                        <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '600' }}>
                          ✅ Uploaded successfully!
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '400' }}>
                            Key: {uploadedFileInfo.fileKey}
                          </div>
                          <button 
                            type="button"
                            onClick={() => setUploadedFileInfo(null)}
                            style={{ color: '#ef4444', textDecoration: 'underline', marginTop: '6px', fontSize: '11px', border: 'none', background: 'none', cursor: 'pointer' }}
                          >
                            Replace File
                          </button>
                        </div>
                      ) : (
                        <div>
                          <input 
                            type="file"
                            id="fileUploadInput"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            accept={
                              resourceType === 'pdf' ? '.pdf' : 
                              resourceType === 'ppt' ? '.ppt,.pptx' : 
                              resourceType === 'doc' ? '.doc,.docx' : 'image/*'
                            }
                          />
                          <label 
                            htmlFor="fileUploadInput"
                            style={{ cursor: 'pointer', fontSize: '13px', color: '#3b82f6', fontWeight: '600' }}
                          >
                            Click here to choose file
                          </label>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Supported sizes up to 50MB
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tags (comma separated) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    TAGS (COMMA SEPARATED)
                  </label>
                  <input
                    type="text"
                    value={resourceTags}
                    onChange={(e) => setResourceTags(e.target.value)}
                    placeholder="e.g. nodejs, api, tutorial"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    Type tag names separated by a comma (,)
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowResourceModal(false)}
                    className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingFile}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow disabled:opacity-50"
                  >
                    {resourceAction === 'create' ? 'Add Resource' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
