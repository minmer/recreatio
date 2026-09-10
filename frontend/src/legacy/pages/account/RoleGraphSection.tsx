import ReactFlow, { Background, ConnectionLineType, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../content/types';
import { RoleGraphControls, RoleGraphPanel, useRoleNetwork } from '../../features/roleGraph';

export function RoleGraphSection({ copy }: { copy: Copy }) {
  const graph = useRoleNetwork(copy);
  const {
    nodes,
    edges,
    nodeTypes,
    edgeTypes,
    onNodesChange,
    onEdgesChange,
    loading,
    search,
    setSearch,
    showReachable,
    setShowReachable,
    isFullscreen,
    setIsFullscreen,
    isCompact,
    compactView,
    setCompactView,
    filters,
    setFilters,
    contextMenu,
    setContextMenu,
    contextRoleId,
    setContextRoleId,
    contextNode,
    contextNodeCanWrite,
    contextNodeCanLink,
    handleContextAddRole,
    handlePrepareRecovery,
    handleConnect,
    isValidConnection,
    panelState,
    panelForm,
    panelSetters,
    panelHandlers,
    setSelectedNodeId,
    setSelectedEdgeId
  } = graph;

  return (
    <section className="account-card" id="roles">
      <h3>{copy.account.sections.roles}</h3>
      <p className="note">{copy.account.roles.lead}</p>
      <RoleGraphControls
        copy={copy}
        search={search}
        onSearchChange={setSearch}
        showReachable={showReachable}
        onToggleReachable={setShowReachable}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
        filters={filters}
        onToggleFilter={(type, next) => setFilters((prev) => ({ ...prev, [type]: next }))}
      />
      <div
        className={`role-graph ${isFullscreen ? 'is-fullscreen' : ''} ${isCompact ? 'is-compact' : ''} ${
          isCompact ? `view-${compactView}` : ''
        }`}
      >
        {isCompact && (
          <div className="role-view-toggle">
            <button
              type="button"
              className={`chip ${compactView === 'graph' ? 'active' : ''}`}
              onClick={() => setCompactView('graph')}
            >
              {copy.account.roles.viewGraph}
            </button>
            <button
              type="button"
              className={`chip ${compactView === 'panel' ? 'active' : ''}`}
              onClick={() => setCompactView('panel')}
            >
              {copy.account.roles.viewDetails}
            </button>
          </div>
        )}
        <div className="role-flow">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => {
              setContextMenu(null);
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
              if (isCompact) {
                setCompactView('panel');
              }
            }}
            onEdgeClick={(_, edge) => {
              setContextMenu(null);
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
              if (isCompact) {
                setCompactView('panel');
              }
            }}
            onPaneClick={() => setContextMenu(null)}
            onPaneContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ x: event.clientX, y: event.clientY, type: 'canvas' });
              setContextRoleId('');
            }}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              setContextMenu({ x: event.clientX, y: event.clientY, type: 'node', nodeId: node.id });
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
              if (isCompact) {
                setCompactView('panel');
              }
            }}
            onConnect={handleConnect}
            isValidConnection={isValidConnection}
            fitView
            minZoom={0.4}
            maxZoom={1.8}
            onlyRenderVisibleElements
            zoomOnScroll
            panOnScroll={false}
            preventScrolling
            connectionLineType={ConnectionLineType.Bezier}
          >
            <Background gap={24} size={1} color="rgba(40, 48, 56, 0.08)" />
            <Controls showInteractive={false} />
          </ReactFlow>
          {contextMenu && (
            <div className="role-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
              {contextMenu.type === 'canvas' && (
                <div className="role-context-block">
                  <strong>{copy.account.roles.contextAddRoleTitle}</strong>
                  <input
                    type="text"
                    placeholder={copy.account.roles.contextAddRolePlaceholder}
                    value={contextRoleId}
                    onChange={(event) => setContextRoleId(event.target.value)}
                  />
                  <button type="button" className="chip" onClick={handleContextAddRole}>
                    {copy.account.roles.contextAddRoleAction}
                  </button>
                  <button type="button" className="ghost" onClick={() => setContextMenu(null)}>
                    {copy.account.roles.contextClose}
                  </button>
                </div>
              )}
              {contextMenu.type === 'node' && contextNode && (
                <div className="role-context-block">
                  <strong>{contextNode.data.label}</strong>
                  {contextNode.data.nodeType === 'role' && contextNodeCanWrite && (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        setContextMenu(null);
                        setSelectedNodeId(contextNode.id);
                        if (isCompact) {
                          setCompactView('panel');
                        }
                      }}
                    >
                      {copy.account.roles.contextAddData}
                    </button>
                  )}
                  {contextNode.data.nodeType === 'role' && contextNodeCanLink && contextNode.data.roleId && (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        setContextMenu(null);
                        void handlePrepareRecovery(contextNode.data.roleId);
                      }}
                    >
                      {copy.account.roles.contextPrepareRecovery}
                    </button>
                  )}
                  <button type="button" className="ghost" onClick={() => setContextMenu(null)}>
                    {copy.account.roles.contextClose}
                  </button>
                </div>
              )}
            </div>
          )}
          {loading && <div className="role-loading">{copy.account.roles.loading}</div>}
          {!loading && nodes.length === 0 && <div className="role-loading">{copy.account.roles.noNodes}</div>}
        </div>
        <RoleGraphPanel copy={copy} state={panelState} form={panelForm} setForm={panelSetters} handlers={panelHandlers} />
      </div>
    </section>
  );
}
