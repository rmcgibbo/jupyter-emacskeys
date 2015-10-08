from setuptools import setup
from basesetup import cmdclass

setup(
    name='jupyter-emacskeys',
    version="0.2.2",
    description="Emacs-style keybindings for the Jupyter notebook",
    author="Robert T. McGibbon",    
    author_email="rmcgibbo@gmail.com",
    license="New BSD license",
    classifiers=['Development Status :: 3 - Alpha',
                 'Programming Language :: Python',
                 'License :: OSI Approved'],
    packages=['jupyter_emacskeys'],
    setup_requires=['ipython>=4', 'notebook>=4'],
    install_requires=['ipython>=4', 'notebook>=4'],
    cmdclass=cmdclass('jupyter_emacskeys', enable=True),
    include_package_data=True,
)
