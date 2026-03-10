import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Criterion {
  id?: string;
  criterion_name: string;
  description: string;
  weight: string;
  max_score: string;
  criterion_type: 'numeric' | 'yes_no' | 'picklist';
  picklist_options_text: string;
}

const DEFAULT_CRITERIA: Omit<Criterion, 'id'>[] = [
  { criterion_name: 'Price/Cost', description: 'Competitiveness of the bid amount', weight: '3', max_score: '10', criterion_type: 'numeric', picklist_options_text: '' },
  { criterion_name: 'Experience', description: 'Relevant project experience and track record', weight: '2', max_score: '10', criterion_type: 'numeric', picklist_options_text: '' },
  { criterion_name: 'Timeline', description: 'Proposed schedule and ability to meet deadlines', weight: '2', max_score: '10', criterion_type: 'numeric', picklist_options_text: '' },
  { criterion_name: 'Quality', description: 'Expected quality of work and materials', weight: '2', max_score: '10', criterion_type: 'numeric', picklist_options_text: '' },
  { criterion_name: 'References', description: 'Quality of references and past client satisfaction', weight: '1', max_score: '10', criterion_type: 'numeric', picklist_options_text: '' },
];

export default function AddScoringCriterion() {
  const { rfpId } = useParams<{ rfpId: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>([
    { criterion_name: '', description: '', weight: '1', max_score: '10', criterion_type: 'numeric', picklist_options_text: '' }
  ]);

  const addCriterion = () => {
    setCriteria(prev => [
      ...prev,
      { criterion_name: '', description: '', weight: '1', max_score: '10', criterion_type: 'numeric', picklist_options_text: '' }
    ]);
  };

  const removeCriterion = (index: number) => {
    if (criteria.length > 1) {
      setCriteria(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateCriterion = (index: number, field: keyof Criterion, value: string) => {
    setCriteria(prev => prev.map((c, i) => 
      i === index ? { ...c, [field]: value } : c
    ));
  };

  const parsePicklistOptions = (raw: string) => {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [labelPart, scorePart] = line.split('|').map((value) => value?.trim() ?? '');
        const score = Number(scorePart);
        return {
          label: labelPart,
          score: Number.isFinite(score) ? score : 0,
        };
      })
      .filter((option) => option.label.length > 0);
  };

  const loadDefaultCriteria = () => {
    setCriteria(DEFAULT_CRITERIA);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validCriteria = criteria.filter(c => c.criterion_name.trim());
    
    if (validCriteria.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least one criterion',
        variant: 'destructive'
      });
      return;
    }

    const invalidPicklist = validCriteria.find(
      (criterion) => criterion.criterion_type === 'picklist' && parsePicklistOptions(criterion.picklist_options_text).length === 0,
    );
    if (invalidPicklist) {
      toast({
        title: 'Validation Error',
        description: `Add at least one picklist option for "${invalidPicklist.criterion_name}".`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const criteriaToInsert = validCriteria.map((c, index) => ({
        rfp_id: rfpId,
        company_id: currentCompany!.id,
        criterion_name: c.criterion_name.trim(),
        description: c.description.trim() || null,
        weight: parseFloat(c.weight) || 1,
        max_score: parseInt(c.max_score) || 10,
        criterion_type: c.criterion_type,
        criterion_options: c.criterion_type === 'picklist' ? parsePicklistOptions(c.picklist_options_text) : null,
        sort_order: index
      }));

      const { error } = await supabase
        .from('bid_scoring_criteria')
        .insert(criteriaToInsert);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${criteriaToInsert.length} criterion(s) added successfully`
      });

      navigate(`/construction/rfps/${rfpId}`);
    } catch (error: any) {
      console.error('Error adding criteria:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add criteria',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add Scoring Criteria</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Criteria</CardTitle>
                <CardDescription>Add weighted criteria to evaluate vendor bids</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={loadDefaultCriteria}>
                Load Defaults
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {criteria.map((criterion, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Criterion {index + 1}</h4>
                  {criteria.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeCriterion(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={criterion.criterion_name}
                      onChange={(e) => updateCriterion(index, 'criterion_name', e.target.value)}
                      placeholder="e.g., Price, Experience, Quality"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Weight</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="10"
                        value={criterion.weight}
                        onChange={(e) => updateCriterion(index, 'weight', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Score</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={criterion.max_score}
                        onChange={(e) => updateCriterion(index, 'max_score', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Input Type</Label>
                  <Select
                    value={criterion.criterion_type}
                    onValueChange={(value) => {
                      setCriteria((prev) =>
                        prev.map((entry, entryIndex) =>
                          entryIndex === index
                            ? {
                                ...entry,
                                criterion_type: value as Criterion['criterion_type'],
                                max_score: value === 'yes_no' ? '1' : entry.max_score,
                              }
                            : entry,
                        ),
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">Numeric Score</SelectItem>
                      <SelectItem value="yes_no">Yes / No</SelectItem>
                      <SelectItem value="picklist">Picklist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {criterion.criterion_type === 'picklist' && (
                  <div className="space-y-2">
                    <Label>Picklist Options</Label>
                    <Textarea
                      value={criterion.picklist_options_text}
                      onChange={(e) => updateCriterion(index, 'picklist_options_text', e.target.value)}
                      placeholder={`Concrete | 10\nWood | 7\nOther | 4`}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      One option per line using format: <code>Label | Score</code>
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={criterion.description}
                    onChange={(e) => updateCriterion(index, 'description', e.target.value)}
                    placeholder="Describe what this criterion evaluates..."
                    rows={2}
                  />
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" className="w-full" onClick={addCriterion}>
              <Plus className="h-4 w-4 mr-2" />
              Add Another Criterion
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Criteria'}
          </Button>
        </div>
      </form>
    </div>
  );
}
