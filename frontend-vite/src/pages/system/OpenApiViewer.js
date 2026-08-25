import React, { useState, useEffect } from 'react';
import { getApiBase } from '../../core/data_connecter/apiBase';

// ─── Color map ───────────────────────────────────────────────────
const METHOD_COLORS = {
  GET:    { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  POST:   { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  PUT:    { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  PATCH:  { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  DELETE: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
};

const defaultMethodColor = { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };

// ─── Helpers ─────────────────────────────────────────────────────

function methodColor(method) {
  return METHOD_COLORS[method?.toUpperCase()] || defaultMethodColor;
}

function paramLabel(param) {
  const required = param.required ? ' *' : '';
  return `${param.name}${required}`;
}

function firstExampleFromSchema(schema) {
  if (!schema) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return schema.enum[0];

  switch (schema.type) {
    case 'string':  return schema.minLength ? 'x'.repeat(schema.minLength) : 'string';
    case 'integer': return schema.minimum ?? (schema.exclusiveMinimum ?? 0) + 1 ?? 1;
    case 'number':  return schema.minimum ?? (schema.exclusiveMinimum ?? 0) + 0.5 ?? 1.0;
    case 'boolean': return true;
    case 'array':   return [];
    case 'object': {
      const ex = {};
      if (schema.properties) {
        for (const [k, v] of Object.entries(schema.properties)) {
          ex[k] = firstExampleFromSchema(v);
        }
        return ex;
      }
      return {};
    }
    default: return null;
  }
}

function resolveRef(spec, ref) {
  if (!ref || !ref.startsWith('#/')) return null;
  const parts = ref.replace('#/', '').split('/');
  let node = spec;
  for (const p of parts) {
    if (!node || typeof node !== 'object') return null;
    node = node[p];
  }
  return node;
}

// ─── Tag Badge ───────────────────────────────────────────────────

function tagColor(tag) {
  const hash = [...(tag || '')].reduce((s, c) => s + c.charCodeAt(0), 0);
  const colors = ['#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#06b6d4','#ef4444','#22c55e'];
  return colors[hash % colors.length];
}

// ─── JSON Pretty ─────────────────────────────────────────────────

function JsonPretty({ data }) {
  return (
    <pre style={{
      background: '#1e293b', color: '#a7f3d0', padding: '10px 14px',
      borderRadius: 6, fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      margin: '8px 0 0', overflowX: 'auto', maxHeight: 300, overflowY: 'auto',
      whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5,
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ─── Try It Section ──────────────────────────────────────────────

function TryIt({ method, path, params, requestBody, opId }) {
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);

  // Init form with examples
  useEffect(() => {
    const init = {};
    (params || []).forEach(p => {
      const ex = firstExampleFromSchema(p.schema);
      if (ex != null) init[p.name] = ex;
    });
    if (requestBody) {
      const schema = requestBody?.content?.['application/json']?.schema;
      const ex = firstExampleFromSchema(schema);
      if (ex && typeof ex === 'object') {
        init._body = JSON.stringify(ex, null, 2);
      }
    }
    setForm(init);
  }, [opId]);

  if (!show) {
    return (
      <button onClick={() => setShow(true)}
        style={{ marginTop: 8, padding: '4px 14px', borderRadius: 6, border: '1px solid #d1d5db',
          background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#374151' }}>
        ▶ Try it
      </button>
    );
  }

  const execute = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const apiBase = getApiBase();
      let targetPath = path;
      // Substitute path params
      (params || []).filter(p => p.in === 'path').forEach(p => {
        targetPath = targetPath.replace(`{${p.name}}`, encodeURIComponent(form[p.name] ?? ''));
      });

      const fetchOpts = { method, headers: { 'Content-Type': 'application/json' } };
      if (['POST', 'PUT', 'PATCH'].includes(method) && form._body) {
        fetchOpts.body = form._body;
      }

      const proxyUrl = `${apiBase}/energy-feed/proxy?path=${encodeURIComponent(targetPath)}`;
      const resp = await fetch(proxyUrl, fetchOpts);
      const data = await resp.json();
      setResult({ status: resp.status, data });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 8, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
      {/* Path params */}
      {(params || []).filter(p => p.in === 'path').map(p => (
        <div key={p.name} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', minWidth: 100 }}>{p.name} *</span>
          <input value={form[p.name] ?? ''} onChange={e => setForm({...form, [p.name]: e.target.value})}
            placeholder={p.description || p.name}
            style={{ flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 11, fontFamily: 'monospace' }} />
        </div>
      ))}
      {/* Query params */}
      {(params || []).filter(p => p.in === 'query').map(p => (
        <div key={p.name} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', minWidth: 100 }}>{p.name}{p.required ? ' *' : ''}</span>
          <input value={form[p.name] ?? ''} onChange={e => setForm({...form, [p.name]: e.target.value})}
            placeholder={p.description || p.name}
            style={{ flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 11, fontFamily: 'monospace' }} />
        </div>
      ))}
      {/* Request body */}
      {requestBody && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Request body</span>
          <textarea value={form._body || ''} onChange={e => setForm({...form, _body: e.target.value})}
            rows={6}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', resize: 'vertical' }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={execute} disabled={loading}
          style={{ padding: '5px 16px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
          {loading ? '⏳ Sending…' : '▶ Send'}
        </button>
        <button onClick={() => setShow(false)}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 11, color: '#64748b' }}>
          Cancel
        </button>
      </div>
      {error && <div style={{ marginTop: 8, color: '#dc2626', fontSize: 11 }}>❌ {error}</div>}
      {result && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: result.status < 400 ? '#16a34a' : '#dc2626' }}>
            {result.status < 400 ? '✅' : '❌'} {result.status}
          </div>
          <JsonPretty data={result.data} />
        </div>
      )}
    </div>
  );
}

// ─── Endpoint Card ───────────────────────────────────────────────

function EndpointCard({ method, path, operation, spec, opId }) {
  const [expanded, setExpanded] = useState(false);
  const mc = methodColor(method);
  const params = operation.parameters || [];
  const requestBody = operation.requestBody;
  const responses = operation.responses || {};

  // Resolve request body schema
  let bodySchema = null;
  if (requestBody?.content?.['application/json']?.schema) {
    const s = requestBody.content['application/json'].schema;
    bodySchema = s.$ref ? resolveRef(spec, s.$ref) : s;
  }

  // Resolve response schemas
  const resolvedResponses = {};
  Object.entries(responses).forEach(([code, r]) => {
    const content = r.content?.['application/json'];
    if (content?.schema) {
      resolvedResponses[code] = {
        description: r.description,
        schema: content.schema.$ref ? resolveRef(spec, content.schema.$ref) : content.schema,
      };
    } else {
      resolvedResponses[code] = { description: r.description, schema: null };
    }
  });

  return (
    <div style={{ border: `1px solid ${expanded ? mc.border : '#e5e7eb'}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: '#fff' }}>
      {/* Header row — click to expand */}
      <div onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', gap: 12, background: expanded ? '#fafafa' : '#fff' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
          fontFamily: 'monospace', background: mc.bg, color: mc.text, border: `1px solid ${mc.border}`,
          minWidth: 52, textAlign: 'center',
        }}>
          {method}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#0f172a', flex: 1 }}>
          {path}
        </span>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {operation.summary || operation.description || ''}
        </span>
        <span style={{ fontSize: 14, color: '#94a3b8', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid #f1f5f9' }}>
          {/* Description */}
          {(operation.description && operation.description !== operation.summary) && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{operation.description}</p>
          )}

          {/* Parameters */}
          {params.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>Parameters</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600 }}>In</th>
                    <th style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600 }}>Required</th>
                    <th style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600 }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map(p => (
                    <tr key={p.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#0f172a' }}>{paramLabel(p)}</td>
                      <td style={{ padding: '4px 8px', color: '#64748b' }}>{p.in}</td>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#2563eb' }}>{p.schema?.type || '—'}</td>
                      <td style={{ padding: '4px 8px' }}>{p.required ? '✅' : '—'}</td>
                      <td style={{ padding: '4px 8px', color: '#475569' }}>{p.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Request body */}
          {bodySchema && (
            <div style={{ marginTop: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>Request Body</h4>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', marginBottom: 4 }}>
                application/json {bodySchema.title ? `— ${bodySchema.title}` : ''}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600 }}>Field</th>
                    <th style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600 }}>Required</th>
                    <th style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600 }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {bodySchema.properties && Object.entries(bodySchema.properties).map(([name, prop]) => {
                    const isRequired = (bodySchema.required || []).includes(name);
                    return (
                      <tr key={name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#0f172a' }}>{name}{isRequired ? ' *' : ''}</td>
                        <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#2563eb' }}>{prop.type || '—'}</td>
                        <td style={{ padding: '4px 8px' }}>{isRequired ? '✅' : '—'}</td>
                        <td style={{ padding: '4px 8px', color: '#475569' }}>{prop.description || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>Example:</span>
                <JsonPretty data={firstExampleFromSchema(bodySchema)} />
              </div>
            </div>
          )}

          {/* Responses */}
          {Object.keys(resolvedResponses).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>Responses</h4>
              {Object.entries(resolvedResponses).map(([code, r]) => (
                <div key={code} style={{ marginBottom: 8 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                    background: Number(code) < 400 ? '#dcfce7' : '#fee2e2',
                    color: Number(code) < 400 ? '#166534' : '#991b1b',
                    marginRight: 8,
                  }}>
                    {code}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{r.description || ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Try it */}
          <TryIt method={method} path={path} params={params} requestBody={requestBody} opId={opId} />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function OpenApiViewer() {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchSpec = async () => {
      try {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/energy-feed/openapi`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setSpec(data);
      } catch (e) {
        if (mounted) setError(e.message);
      }
      if (mounted) setLoading(false);
    };
    fetchSpec();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        ⏳ Loading API documentation…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
        ❌ Failed to load API docs: {error}
        <div style={{ marginTop: 4, fontSize: 11, color: '#b91c1c' }}>
          The energy feed is only available on production (via compute3 VPN).
        </div>
      </div>
    );
  }

  if (!spec) return null;

  const { info, paths } = spec;
  const endpoints = [];
  const tagSet = new Set();

  // Flatten paths into endpoint list
  Object.entries(paths || {}).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, operation]) => {
      const tags = operation.tags || ['Default'];
      tags.forEach(t => tagSet.add(t));
      endpoints.push({
        method: method.toUpperCase(),
        path,
        operation,
        opId: operation.operationId || `${method}-${path}`,
        tags,
      });
    });
  });

  // Sort: by tag then path
  endpoints.sort((a, b) => {
    const ta = (a.tags[0] || '');
    const tb = (b.tags[0] || '');
    if (ta !== tb) return ta.localeCompare(tb);
    return a.path.localeCompare(b.path);
  });

  const tags = [...tagSet].sort();

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
          📘 {info?.title || 'Power Simulator API'}
        </h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
          v{info?.version || '?'} · {info?.description || ''}
        </p>
      </div>

      {/* Endpoints grouped by tag */}
      {tags.map(tag => {
        const tagEndpoints = endpoints.filter(e => e.tags.includes(tag));
        return (
          <div key={tag} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: tagColor(tag),
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{tag}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>({tagEndpoints.length})</span>
            </div>
            {tagEndpoints.map(ep => (
              <EndpointCard key={ep.opId} {...ep} spec={spec} />
            ))}
          </div>
        );
      })}

      {/* Footer */}
      <p style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8', margin: '12px 0 0' }}>
        OpenAPI {spec.openapi || '?'} · Powered by FastAPI
      </p>
    </div>
  );
}
