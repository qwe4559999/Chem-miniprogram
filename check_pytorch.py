import torch

try:
    print(f"PyTorch version: {torch.__version__}")
    # Create a simple tensor
    x = torch.rand(2, 3)
    print("Successfully created a PyTorch tensor:")
    print(x)
    # Check if CUDA is available (optional, but good to know)
    if torch.cuda.is_available():
        print(f"CUDA is available. GPU: {torch.cuda.get_device_name(0)}")
        # Try creating a tensor on GPU
        y = torch.rand(2, 3, device='cuda')
        print("Successfully created a tensor on GPU:")
        print(y)
    else:
        print("CUDA is not available. Running on CPU.")
    print("\nPyTorch installation appears to be working correctly!")
except ImportError:
    print("Error: PyTorch is not installed. Please install it using pip or conda.")
except Exception as e:
    print(f"An unexpected error occurred: {e}") 