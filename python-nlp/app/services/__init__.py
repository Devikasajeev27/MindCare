"""
MindCare Python NLP Services package.
"""
import sys
import os

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
NLP_ROOT = os.path.dirname(os.path.dirname(SERVICES_DIR))

if NLP_ROOT not in sys.path:
    sys.path.insert(0, NLP_ROOT)

try:
    from nlp import analysis, nltk_engine, spacy_engine
except ImportError:
    import analysis, nltk_engine, spacy_engine
