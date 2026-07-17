import React, { useState, useEffect } from 'react'
import useAuthStore from '../stores/authStore'
import Sidebar from '../components/Sidebar'
import ThemeToggle from '../components/ThemeToggle'
import ProfileDropdown from '../components/ProfileDropdown'
import { API_URL } from '../config.js'

export default function StudentLibraryPage() {
  const { user, token } = useAuthStore()

  // Main state
  const [resources, setResources] = useState([])
  const [sessions, setSessions] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [bookmarks, setBookmarks] = useState([]) // list of resource IDs
  const [completions, setCompletions] = useState([]) // list of resource IDs
  
  // UI states
  const [loading, setLoading] = useState(true)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [error, setError] = useState(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [allTags, setAllTags] = useState([])

  useEffect(() => {
    if (token) {
      fetchSessions()
      fetchBookmarks()
      fetchCompletions()
      fetchRecommendations()
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchResources()
    }
  }, [token, searchQuery, selectedTopicId, selectedType, selectedTag])

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/resources/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setSessions(data.hierarchy || [])
      }
    } catch (err) {
      console.error('Error fetching sessions:', err)
    }
  }

  const fetchResources = async () => {
    setLoading(true)
    try {
      let url = `${API_URL}/resources?`
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`
      if (selectedTopicId) url += `topicId=${selectedTopicId}&`
      if (selectedType) url += `type=${selectedType}&`
      if (selectedTag) url += `tag=${encodeURIComponent(selectedTag)}&`

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setResources(data.resources || [])
        
        // Extract all unique tags for filtering dropdown
        const tagsSet = new Set()
        data.resources.forEach(r => {
          if (r.tags) r.tags.forEach(tag => tagsSet.add(tag))
        })
        setAllTags(Array.from(tagsSet))
      }
    } catch (err) {
      console.error(err)
      setError('Failed to fetch library resources.')
    } finally {
      setLoading(false)
    }
  }

  const fetchBookmarks = async () => {
    try {
      const res = await fetch(`${API_URL}/resources/bookmarks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setBookmarks(data.bookmarks?.map(b => b._id) || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchCompletions = async () => {
    try {
      const res = await fetch(`${API_URL}/resources/completions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setCompletions(data.completions || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchRecommendations = async () => {
    setLoadingRecs(true)
    try {
      const res = await fetch(`${API_URL}/resources/recommendations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setRecommendations(data.recommendations || [])
      }
    } catch (err) {
      console.error('Failed to fetch recommended resources:', err)
    } finally {
      setLoadingRecs(false)
    }
  }

  const handleToggleBookmark = async (resourceId) => {
    try {
      const res = await fetch(`${API_URL}/resources/bookmark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resourceId })
      })
      const data = await res.json()
      if (data.success) {
        if (data.bookmarked) {
          setBookmarks(prev => [...prev, resourceId])
        } else {
          setBookmarks(prev => prev.filter(id => id !== resourceId))
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleComplete = async (resourceId) => {
    try {
      const res = await fetch(`${API_URL}/resources/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resourceId })
      })
      const data = await res.json()
      if (data.success) {
        if (data.completed) {
          setCompletions(prev => [...prev, resourceId])
        } else {
          setCompletions(prev => prev.filter(id => id !== resourceId))
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

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
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>📚 Learning Library</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>
              Access, study, bookmark and track your course materials
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ThemeToggle />
            <ProfileDropdown />
          </div>
        </header>

        {/* Content Body */}
        <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* 🎯 Section 1: Personalized AI Recommendations Carousel */}
          {recommendations.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '20px',
              padding: '24px'
            }}>
              <h2 style={{
                margin: '0 0 16px',
                fontSize: '17px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🎯 Recommended for your Weak Areas
                <span style={{ fontSize: '11px', background: '#eab308', color: '#1e1b4b', padding: '2px 8px', borderRadius: '20px', fontWeight: '700' }}>
                  AI SUGGESTED
                </span>
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '16px'
              }}>
                {recommendations.map((rec) => {
                  const isBookmarked = bookmarks.includes(rec._id)
                  const isCompleted = completions.includes(rec._id)
                  
                  return (
                    <div
                      key={rec._id}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '14px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                        boxShadow: 'var(--card-shadow)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '22px' }}>{getResourceIcon(rec.type)}</span>
                          <span style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: '600' }}>
                            {rec.topic?.name}
                          </span>
                        </div>
                        <h4 style={{ margin: '8px 0 4px', fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {rec.title}
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {rec.tags?.slice(0, 2).map((tag, idx) => (
                            <span key={idx} style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <a
                          href={rec.url.startsWith('/') ? `${API_URL.replace('/api', '')}${rec.url}` : rec.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ flex: 1, textDecoration: 'none' }}
                        >
                          <button style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}>
                            Study Now
                          </button>
                        </a>
                        <button 
                          onClick={() => handleToggleBookmark(rec._id)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}
                        >
                          {isBookmarked ? '⭐' : '☆'}
                        </button>
                        <button 
                          onClick={() => handleToggleComplete(rec._id)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}
                        >
                          {isCompleted ? '✅' : '⬜'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Core View: Left Sidebar Filters + Right Grid */}
          <div style={{ display: 'flex', gap: '32px' }}>
            
            {/* Filter sidebar */}
            <div style={{
              width: '260px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              height: 'fit-content'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Filters</h3>
              
              {/* Search */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  SEARCH
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, tag..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Topic Select */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  TOPIC
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    fontSize: '13px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="">All Topics</option>
                  {sessions.map(s => (
                    <optgroup key={s._id} label={s.name}>
                      {s.topics?.map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Type Select */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  FORMAT
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    fontSize: '13px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="">All Formats</option>
                  <option value="pdf">📄 PDF Documents</option>
                  <option value="ppt">📊 PowerPoint files</option>
                  <option value="doc">📝 Word files</option>
                  <option value="image">🖼️ Image assets</option>
                  <option value="link">🔗 Web Links</option>
                  <option value="youtube">🎥 YouTube Videos</option>
                  <option value="github">💻 GitHub Repositories</option>
                </select>
              </div>

              {/* Tags Select */}
              {allTags.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    TAGS
                  </label>
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      outline: 'none',
                      fontSize: '13px',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">All Tags</option>
                    {allTags.map((t, idx) => (
                      <option key={idx} value={t}>#{t}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Resources Display Feed */}
            <div style={{ flex: 1 }}>
              {loading ? (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '60px 0' }}>
                  Loading learning materials...
                </div>
              ) : error ? (
                <div style={{ color: '#ef4444', textAlign: 'center', padding: '40px 0' }}>
                  {error}
                </div>
              ) : resources.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 0',
                  border: '2px dashed var(--border-color)',
                  borderRadius: '16px',
                  color: 'var(--text-secondary)'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📖</div>
                  <h3>No resources match filters</h3>
                  <p style={{ fontSize: '13px' }}>Try resetting or modifying your filter values.</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '20px'
                }}>
                  {resources.map((resItem) => {
                    const isBookmarked = bookmarks.includes(resItem._id)
                    const isCompleted = completions.includes(resItem._id)

                    return (
                      <div
                        key={resItem._id}
                        style={{
                          background: 'var(--bg-card)',
                          border: isCompleted ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                          borderRadius: '14px',
                          padding: '18px',
                          boxShadow: 'var(--card-shadow)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '16px',
                          position: 'relative'
                        }}
                      >
                        {/* Upper Details */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '24px' }}>{getResourceIcon(resItem.type)}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                title="Bookmark resource"
                                onClick={() => handleToggleBookmark(resItem._id)}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  fontSize: '18px',
                                  padding: 0
                                }}
                              >
                                {isBookmarked ? '⭐' : '☆'}
                              </button>
                              <button
                                title={isCompleted ? "Mark incomplete" : "Mark as completed"}
                                onClick={() => handleToggleComplete(resItem._id)}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  fontSize: '18px',
                                  padding: 0
                                }}
                              >
                                {isCompleted ? '✅' : '⬜'}
                              </button>
                            </div>
                          </div>

                          <h3 style={{
                            margin: '12px 0 6px',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            lineHeight: '1.4'
                          }}>
                            {resItem.title}
                          </h3>

                          {/* Subfolder and Tag Chips */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '600' }}>
                              📁 {resItem.topic?.name}
                            </span>
                            {resItem.tags && resItem.tags.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {resItem.tags.map((tag, idx) => (
                                  <span key={idx} style={{
                                    fontSize: '9px',
                                    color: 'var(--text-secondary)',
                                    background: 'var(--bg-primary)',
                                    padding: '2px 6px',
                                    borderRadius: '12px'
                                  }}>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Open Button */}
                        <a
                          href={resItem.url.startsWith('/') ? `${API_URL.replace('/api', '')}${resItem.url}` : resItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`w-full text-center text-xs font-semibold py-2.5 rounded-lg transition block ${
                            isCompleted 
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                          }`}
                        >
                          {isCompleted ? 'Completed ✓ (Reopen)' : 'Open Resource'}
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
