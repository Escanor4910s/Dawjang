import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  addEdge,
  Connection,
  useReactFlow,
  ReactFlowProvider,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Download, Info } from 'lucide-react';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CourseMindMapProps {
  content: string;
  title: string;
}

const generateNodesAndEdges = (title: string, content: string) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  let yCounter = 0;
  
  // Root node
  nodes.push({
    id: 'root',
    data: { label: title },
    position: { x: 50, y: 0 },
    type: 'input',
    style: { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 'bold', borderRadius: '12px', padding: '15px 25px', border: 'none', boxShadow: '0 10px 25px -5px rgba(99,102,241,0.4)' }
  });
  
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  
  let currentSectionId = '';
  let sectionIndex = 0;
  let itemIndex = 0;
  
  lines.forEach((line) => {
    const secMatch = line.match(/^===\s*(.+?)\s*===/) || line.match(/^--\s*(.+?)\s*--/) || line.match(/^#\s+(.+)/);
    if (secMatch) {
      sectionIndex++;
      currentSectionId = `sec-${sectionIndex}`;
      nodes.push({
        id: currentSectionId,
        data: { label: secMatch[1].trim() },
        position: { x: 400, y: yCounter * 80 + 50 },
        style: { background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '2px solid hsl(var(--primary)/0.5)', borderRadius: '8px', padding: '10px 15px', fontWeight: 'bold' }
      });
      edges.push({
        id: `e-root-${currentSectionId}`,
        source: 'root',
        target: currentSectionId,
        animated: true,
        style: { stroke: 'hsl(var(--primary)/0.6)', strokeWidth: 2 }
      });
      yCounter += 1.5;
      return;
    }
    
     
     
     
    // eslint-disable-next-line no-useless-escape
    const bulletMatch = line.match(/^[\-\*]\s+(.+)/) || line.match(/^[0-9]+[\.\)]\s+(.+)/);
    if (bulletMatch && currentSectionId) {
      itemIndex++;
      const itemId = `item-${itemIndex}`;
      const text = bulletMatch[1];
      const maxLen = 60;
      const formattedText = text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
      
      nodes.push({
        id: itemId,
        data: { label: formattedText },
        position: { x: 750, y: yCounter * 80 + 50 },
        style: { background: 'hsl(var(--muted)/0.5)', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '11px', padding: '8px 12px', maxWidth: '250px' }
      });
      edges.push({
        id: `e-${currentSectionId}-${itemId}`,
        source: currentSectionId,
        target: itemId,
        type: 'smoothstep',
        style: { stroke: 'hsl(var(--muted-foreground)/0.3)' }
      });
      yCounter++;
    }
  });
  
  if (nodes.length > 0) {
    nodes[0].position.y = (yCounter * 80 + 50) / 2;
  }
  
  return { nodes, edges };
};

function Flow({ content, title }: CourseMindMapProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => generateNodesAndEdges(title, content), [content, title]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    if (nodes.length > 0) {
      setSelectedNode(nodes[0]);
      setEditLabel(nodes[0].data.label as string);
    } else {
      setSelectedNode(null);
    }
  }, []);

  const handleUpdateLabel = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          n.data = { ...n.data, label: editLabel };
        }
        return n;
      })
    );
  };

  const handleAddChild = () => {
    if (!selectedNode) return;
    const newNodeId = `new-${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      position: { x: selectedNode.position.x + 300, y: selectedNode.position.y + 50 },
      data: { label: 'Nouvelle section' },
      style: { background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '2px solid hsl(var(--primary)/0.5)', borderRadius: '8px', padding: '10px 15px', fontWeight: 'bold' }
    };
    const newEdge: Edge = {
      id: `e-${selectedNode.id}-${newNodeId}`,
      source: selectedNode.id,
      target: newNodeId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'hsl(var(--primary)/0.6)', strokeWidth: 2 }
    };
    
    setNodes((nds) => nds.concat(newNode));
    setEdges((eds) => eds.concat(newEdge));
    toast.success("Section ajoutée");
  };

  const handleDelete = () => {
    if (!selectedNode) return;
    if (selectedNode.id === 'root') {
      toast.error("Vous ne pouvez pas supprimer le nœud principal.");
      return;
    }
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    toast.success("Section supprimée");
  };

  const downloadImage = async () => {
    if (!reactFlowWrapper.current) return;
    toast.loading("Génération de l'image en cours...", { id: "mindmap-dl" });
    try {
      const element = reactFlowWrapper.current.querySelector('.react-flow__pane') as HTMLElement;
      if (!element) throw new Error("Element not found");
      const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Carte_Mentale_${title.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Image téléchargée !", { id: "mindmap-dl" });
    } catch (e) {
      toast.error("Erreur lors du téléchargement.", { id: "mindmap-dl" });
    }
  };

  return (
    <div className="relative w-full h-[700px] rounded-[2rem] border border-border/50 overflow-hidden bg-card/30 backdrop-blur-xl shadow-xl flex flex-col" ref={reactFlowWrapper}>
      {showInstructions && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-11/12 max-w-lg">
          <Alert className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle>Mode d'emploi - Carte Mentale</AlertTitle>
            <AlertDescription className="text-xs">
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li><strong>Sélectionnez</strong> un nœud pour l'éditer, le supprimer ou lui ajouter un enfant.</li>
                <li><strong>Glissez</strong> les nœuds pour réorganiser la carte.</li>
                <li><strong>Molette</strong> pour zoomer/dézoomer.</li>
              </ul>
              <Button size="sm" variant="outline" className="mt-2 w-full h-7 text-xs" onClick={() => setShowInstructions(false)}>Compris, fermer</Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Toolbar */}
      <Panel position="top-right" className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl shadow-lg border border-border/50 backdrop-blur-md m-4 flex flex-col gap-3 min-w-[250px]">
        <div className="font-semibold text-sm flex items-center justify-between">
          <span>Outils d'édition</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowInstructions(true)}><Info className="h-4 w-4" /></Button>
        </div>
        
        {selectedNode ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input 
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onBlur={handleUpdateLabel}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateLabel()}
                className="h-8 text-xs"
                placeholder="Nom de la section"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleAddChild} className="flex-1 h-8 text-xs bg-primary/5 hover:bg-primary/10">
                <Plus className="h-3 w-3 mr-1" /> Enfant
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete} className="flex-1 h-8 text-xs" disabled={selectedNode.id === 'root'}>
                <Trash2 className="h-3 w-3 mr-1" /> Suppr
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-4">
            Sélectionnez un nœud pour l'éditer
          </div>
        )}
        
        <div className="pt-2 border-t border-border mt-1">
          <Button size="sm" onClick={downloadImage} className="w-full h-8 text-xs shadow-md">
            <Download className="h-3 w-3 mr-1" /> Exporter PNG
          </Button>
        </div>
      </Panel>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="bg-grid-white/[0.02]"
        minZoom={0.1}
      >
        <Controls className="bg-background border border-border rounded-xl overflow-hidden shadow-md" />
        <MiniMap 
          nodeStrokeColor={(n) => {
            if (n.id === 'root') return 'hsl(var(--primary))';
            if (n.id.startsWith('sec-')) return 'hsl(var(--primary)/0.5)';
            return 'hsl(var(--muted-foreground))';
          }}
          nodeColor={(n) => {
            if (n.id === 'root') return 'hsl(var(--primary))';
            if (n.id.startsWith('sec-')) return 'hsl(var(--card))';
            return 'hsl(var(--muted)/0.5)';
          }}
          className="bg-background border border-border rounded-xl overflow-hidden shadow-md"
        />
        <Background color="hsl(var(--primary)/0.1)" gap={20} size={1.5} />
      </ReactFlow>
    </div>
  );
}

export default function CourseMindMap(props: CourseMindMapProps) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
