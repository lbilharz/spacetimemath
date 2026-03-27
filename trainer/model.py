import torch
import torch.nn as nn

class DKTModel(nn.Module):
    """
    Deep Knowledge Tracing (DKT) Engine using Long Short-Term Memory (LSTM).
    
    Instead of standard Piech (2015) one-hot vectors, this architecture supports
    "Multi-Skill" interactions, as a single SpacetimeMath problem can trigger 
    multiple Knowledge Components natively linked via our EduGraph ontology.
    """
    def __init__(self, num_kcs: int, hidden_dim: int, num_layers: int = 1):
        super(DKTModel, self).__init__()
        self.num_kcs = num_kcs
        self.hidden_dim = hidden_dim
        
        # We enforce a single-threaded CPU bottleneck to guarantee safe performance
        # inside strict EU containers (e.g. Koyeb 512MB RAM constraints).
        torch.set_num_threads(1)
        
        # The LSTM continuously reads the student's historical interaction sequence.
        # input_size = The number of explicit Knowledge Components (11).
        # We feed it multi-hot tensors: +1 (Correct), -1 (Incorrect), 0 (Untested).
        self.lstm = nn.LSTM(
            input_size=num_kcs, 
            hidden_size=hidden_dim, 
            num_layers=num_layers, 
            batch_first=True
        )
        
        # The decoder projects the hidden intuition back onto the 11 cognitive buckets.
        self.fc = nn.Linear(hidden_dim, num_kcs)
        
        # Binds probabilities strictly between 0% (Failed) and 100% (Mastered).
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        """
        x shape: (batch_size, sequence_length, num_kcs)
        """
        # The hidden layer recursively updates its memory based on the timeline.
        out, (h_n, c_n) = self.lstm(x)
        
        # Projects memory states to cognitive bucket mastery logits.
        logits = self.fc(out)
        
        # Squashes the matrix to actual prediction probabilities.
        predictions = self.sigmoid(logits)
        
        return predictions
