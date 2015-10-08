from setuptools import setup

try:
    from jupyterpip import cmdclass
except:
    import pip, importlib
    pip.main(['install', 'jupyter-pip'])
    cmdclass = importlib.import_module('jupyterpip').cmdclass



setup(
    name='jupyter-emacskeys',
    version="0.2",
    description="Emacs-style keybindings for the Jupyter notebook",
    author="Robert T. McGibbon",    
    author_email="rmcgibbo@gmail.com",
    license="New BSD license",
    classifiers=['Development Status :: 3 - Alpha',
                 'Programming Language :: Python',
                 'License :: OSI Approved'],
    packages=['jupyter_emacskeys'],
    install_requires=["jupyter-pip"],
    cmdclass=cmdclass('jupyter_emacskeys', 'jupyter_emacskeys/init'),
    include_package_data=True,
)
