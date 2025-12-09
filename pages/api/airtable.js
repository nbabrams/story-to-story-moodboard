// pages/api/airtable.js
// This proxies requests to Airtable so your API key stays secret

export default async function handler(req, res) {
  const { action, table, options } = req.body;
  
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appP5rNEZQhzo8HDl';
  
  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ error: 'Airtable API key not configured' });
  }

  try {
    if (action === 'fetch') {
      const params = new URLSearchParams();
      if (options?.filterByFormula) params.append('filterByFormula', options.filterByFormula);
      if (options?.sort) {
        options.sort.forEach((s, i) => {
          params.append(`sort[${i}][field]`, s.field);
          params.append(`sort[${i}][direction]`, s.direction || 'asc');
        });
      }
      
      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Airtable fetch error:', response.status, errorText);
        return res.status(response.status).json({ error: `Airtable error: ${response.status}`, details: errorText });
      }
      
      const data = await response.json();
      return res.status(200).json(data);
      
    } else if (action === 'create') {
      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields: options.fields })
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Airtable create error:', response.status, errorText);
        return res.status(response.status).json({ error: `Airtable error: ${response.status}`, details: errorText });
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    }
    
    return res.status(400).json({ error: 'Invalid action' });
    
  } catch (error) {
    console.error('API route error:', error);
    return res.status(500).json({ error: error.message });
  }
}
